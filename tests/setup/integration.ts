/**
 * Setup for the `integration` Vitest project.
 *
 * Purpose: give every integration test a real PostgreSQL database without
 * requiring a database server (D-009).
 *
 * How it works:
 * 1. Create an in-process PGlite instance (upstream PostgreSQL compiled to WASM).
 * 2. Apply the **same** Drizzle-generated migration SQL that Neon receives, by
 *    reading the committed files in `drizzle/*.sql` in filename order.
 *
 * The committed migration files remain the single source of truth for the
 * schema. Nothing here redefines a table, so a migration and the test database
 * cannot drift apart.
 *
 * `drizzle-kit migrate` is deliberately not used: it requires a `pg`-protocol
 * driver, and PGlite speaks its own protocol. The SQL is identical either way.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const migrationsDir = join(projectRoot, 'drizzle');

let client: PGlite | undefined;

async function applyMigrations(): Promise<string[]> {
  let files: string[];
  try {
    files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith('.sql'))
      .sort();
  } catch {
    return [];
  }

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await client!.exec(sql);
  }

  return files;
}

beforeAll(async () => {
  client = await PGlite.create();
  const applied = await applyMigrations();
  if (applied.length === 0) {
    // Not an error: the schema lands in Phase 1. Integration tests that need
    // tables will fail with a clear "relation does not exist" until then.
    console.warn(
      '[integration] No migrations found in drizzle/ — the test database is empty. ' +
        'Run `pnpm db:generate` first.',
    );
  }
});

afterAll(async () => {
  await client?.close();
  client = undefined;
});

/**
 * Provide a PGlite client to a test.
 *
 * @example
 *   const db = await getTestDatabase();
 */
export async function getTestDatabase(): Promise<PGlite> {
  if (!client) {
    throw new Error('Test database is not initialised. The setup file must run first.');
  }
  return client;
}

/**
 * Truncate every application table between tests.
 *
 * Tests create and clean their own data (TESTING.md → Determinism rules).
 * TRUNCATE ... CASCADE resets foreign keys in one statement and is far faster
 * than deleting rows table by table.
 */
export async function resetTestDatabase(): Promise<void> {
  const db = await getTestDatabase();
  const tables = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name NOT IN ('_migrations')`,
  );

  if (tables.rows.length === 0) {
    return;
  }

  const list = tables.rows.map((row) => `"${row.table_name}"`).join(', ');
  await db.exec(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
