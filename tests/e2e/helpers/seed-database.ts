/**
 * Applying the committed migrations to a test database.
 *
 * Purpose: give the E2E database the same schema the seed script expects,
 * using the same SQL the production database receives.
 *
 * The migration files in `drizzle/` are the source of truth. They are applied
 * in filename order, statement by statement, exactly as `tests/setup/integration.ts`
 * does for the PGlite test database — so the E2E database cannot drift from
 * the integration database (D-009).
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

const projectRoot = join(__dirname, '..', '..', '..');

/**
 * Apply every committed migration to `client`.
 */
export async function applyMigrationsTo(client: PGlite): Promise<void> {
  const migrationsFolder = join(projectRoot, 'drizzle');
  const files = (await readdir(migrationsFolder))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = await readFile(join(migrationsFolder, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed !== '') {
        await client.exec(trimmed);
      }
    }
  }
}
