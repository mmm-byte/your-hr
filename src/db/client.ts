/**
 * Database client (D-015).
 *
 * Uses `drizzle-orm/neon-serverless` over the Neon `Pool` (WebSocket transport),
 * **not** `drizzle-orm/neon-http`. Verified in the installed adapter source:
 * the HTTP driver's `db.transaction()` throws
 * `No transactions support in neon-http driver`, which would make the atomic
 * salary + audit write (SAL-010, AUD-001) impossible.
 *
 * A **local PGlite** database is also supported, chosen by `PGLITE_PATH`. The
 * operational scripts already support it (scripts/README.md), so this makes
 * the application and the scripts agree on one local target instead of two.
 * PGlite is real PostgreSQL compiled to WebAssembly (D-009), so a local run
 * exercises the same SQL as production.
 *
 * Server-only. Importing this from a client component would expose the
 * connection string to the browser.
 */
import 'server-only';

import { Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { env } from '@/lib/env';
import { neonDateTypes, pgliteDateParsers } from './date-parsers';
import { schema } from './schema';

export type Database = NeonDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let pool: Pool | undefined;
let database: Database | undefined;
let pglite: PGlite | undefined;

/**
 * Get the shared connection pool.
 *
 * A module-level singleton so a serverless warm instance reuses connections
 * instead of opening a new pool per request.
 */
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL ?? '',
      max: 10,
      // Neon serverless connections are short-lived; closing idle sockets
      // promptly avoids holding a connection open between requests.
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // Decode `date` columns as raw `YYYY-MM-DD` text so a calendar day
      // never shifts with the server's timezone (RPT-004, D-021).
      types: neonDateTypes,
    });
  }
  return pool;
}

/**
 * Get the shared Drizzle instance.
 *
 * `PGLITE_PATH` selects the local database; otherwise the Neon pool is used.
 *
 * @throws when neither target is configured. It fails loudly rather than
 * falling back to a hard-coded credential (ENVIRONMENT.md → Environment
 * readiness gate).
 */
export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const localPath = env.PGLITE_PATH;

  if (localPath !== undefined && localPath !== '') {
    // The local database uses the same date parser as production, so a
    // calendar day arrives exactly as it does on Neon (D-021).
    pglite = new PGlite(localPath, { parsers: pgliteDateParsers });
    database = drizzlePglite(pglite, { casing: 'snake_case', schema });
    return database;
  }

  database = drizzle(getPool(), { casing: 'snake_case', schema });
  return database;
}
