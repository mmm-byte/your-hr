/**
 * Apply the committed migrations to the target database.
 *
 * Purpose: bring a database up to the schema in `drizzle/` using the same
 * SQL that Neon will receive.
 * Called by: `pnpm db:migrate`.
 * Reads: the committed migration files in drizzle/.
 * Writes: the target database's schema.
 * Rules: DATABASE.md (schema changes only through committed migrations),
 *        D-009 (the same generated SQL serves PGlite and Neon).
 *
 * The migration SQL is applied by executing each committed file in filename
 * order, exactly as tests/setup/integration.ts does for PGlite. Using one
 * code path for both targets is what guarantees the integration tests
 * exercise the schema that production actually receives.
 *
 * A migration that has already been applied is skipped, so the script is
 * safe to run repeatedly.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, resolveDatabaseTarget } from './target';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const migrationsFolder = join(projectRoot, 'drizzle');

/**
 * Read the committed migration files in the order they must be applied.
 */
async function listMigrationFiles(): Promise<string[]> {
  try {
    const entries = await readdir(migrationsFolder);
    return entries.filter((name) => name.endsWith('.sql')).sort();
  } catch {
    return [];
  }
}

/**
 * The name recorded in the migration ledger for a file.
 */
function migrationName(file: string): string {
  return file.replace(/\.sql$/, '');
}

/**
 * Ensure the migration ledger exists.
 */
async function ensureLedger(
  query: (text: string, params?: readonly unknown[]) => Promise<unknown>,
): Promise<void> {
  await query(
    `create table if not exists "_your_hr_migrations" (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  );
}

async function main(): Promise<void> {
  const target = await openDatabase(resolveDatabaseTarget());
  console.log(`Target: ${target.label}`);

  try {
    const files = await listMigrationFiles();
    if (files.length === 0) {
      throw new Error(
        `No migration files found in ${migrationsFolder}. Run \`pnpm db:generate\` first.`,
      );
    }

    await ensureLedger(target.query.bind(target));

    const applied = await target.query<{ name: string }>(
      `select name from "_your_hr_migrations"`,
    );
    const appliedNames = new Set(applied.rows.map((row) => row.name));

    for (const file of files) {
      const name = migrationName(file);
      if (appliedNames.has(name)) {
        console.log(`  skip  ${file} (already applied)`);
        continue;
      }

      const sql = await readFile(join(migrationsFolder, file), 'utf8');
      console.log(`  apply ${file}`);
      await target.transaction(async (tx) => {
        for (const statement of sql.split('--> statement-breakpoint')) {
          const trimmed = statement.trim();
          if (trimmed !== '') {
            await tx.query(trimmed);
          }
        }
        await tx.query(`insert into "_your_hr_migrations" (name) values ($1)`, [name]);
      });
    }

    console.log('Migrations applied successfully.');
  } finally {
    await target.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
