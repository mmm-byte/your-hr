/**
 * Database client (D-015).
 *
 * Uses `drizzle-orm/neon-serverless` over the Neon `Pool` (WebSocket transport),
 * **not** `drizzle-orm/neon-http`. Verified in the installed adapter source:
 * the HTTP driver's `db.transaction()` throws
 * `No transactions support in neon-http driver`, which would make the atomic
 * salary + audit write (SAL-010, AUD-001) impossible.
 *
 * Server-only. Importing this from a client component would expose the
 * connection string to the browser.
 */
import 'server-only';

import { Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { env } from '@/lib/env';
import { neonDateTypes } from './date-parsers';
import { schema } from './schema';

export type Database = NeonDatabase<typeof schema>;

let pool: Pool | undefined;
let database: Database | undefined;

/**
 * Get the shared connection pool.
 *
 * A module-level singleton so a serverless warm instance reuses connections
 * instead of opening a new pool per request.
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
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
 * @throws when `DATABASE_URL` is missing. It fails loudly rather than falling
 * back to a hard-coded credential (ENVIRONMENT.md → Environment readiness gate).
 */
export function getDatabase(): Database {
  if (!database) {
    database = drizzle(getPool(), { casing: 'snake_case', schema });
  }
  return database;
}
