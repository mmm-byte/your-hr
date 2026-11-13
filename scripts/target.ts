/**
 * Database target resolution for the operational scripts.
 *
 * Purpose: let `db:migrate`, `db:seed`, and `db:verify` run against either
 * a real PostgreSQL server (Neon) or a local PGlite file, chosen by one
 * environment variable, without any of them growing its own connection code.
 * Called by: scripts/migrate.ts, scripts/seed.ts, scripts/verify.ts.
 * Reads: the DATABASE_URL and PGLITE_PATH environment variables.
 * Rules: ENVIRONMENT.md (server-only secrets), D-009 (PGlite is a test and
 *        local-development target, never the production datastore).
 *
 * The target is decided explicitly and printed, so an operator can never
 * accidentally seed a production database believing they were working
 * locally (scripts/README.md → Safe target check before destructive work).
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Pool, type QueryResultRow } from '@neondatabase/serverless';
import { neonDateTypes, pgliteDateParsers } from '../src/db/date-parsers';

/** Where a script should write. */
export type DatabaseTarget =
  | { kind: 'postgres'; url: string; label: string }
  | { kind: 'pglite'; path: string; label: string };

/**
 * Resolve the target database.
 *
 * `PGLITE_PATH` takes precedence when it is set, which is how the local
 * development database and the seeded test database are addressed without a
 * server. Otherwise `DATABASE_URL` is used.
 *
 * @throws when neither is configured, with a message that says exactly what
 * to set.
 */
export function resolveDatabaseTarget(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseTarget {
  const pglitePath = env.PGLITE_PATH?.trim();
  if (pglitePath) {
    const absolute = resolve(pglitePath);
    return {
      kind: 'pglite',
      path: absolute,
      label: `PGlite (${absolute})`,
    };
  }

  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'No database target configured. Set DATABASE_URL for a PostgreSQL server, ' +
        'or PGLITE_PATH for a local PGlite database.',
    );
  }

  // The URL is never printed in full — it carries the password.
  return {
    kind: 'postgres',
    url,
    label: `PostgreSQL at ${redactUrl(url)}`,
  };
}

/**
 * Hide the credentials in a connection string so it can be logged safely.
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parsed.port ? `:${parsed.port}` : '';
    const database = parsed.pathname.replace(/^\//, '');
    return `${host}${port}/${database}`;
  } catch {
    return '(unparseable connection string)';
  }
}

/**
 * Ensure the directory that holds a PGlite database exists.
 */
export function ensureParentDirectory(path: string): void {
  const parent = dirname(path);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
}

/** The result rows of a query. */
export interface QueryResult<Row = Record<string, unknown>> {
  rows: Row[];
}

/**
 * A database handle with the small surface the operational scripts need.
 *
 * `query` takes a statement with `$1`-style placeholders and an array of
 * parameters. `transaction` runs a body inside a single transaction that
 * commits on success and rolls back on any thrown error.
 */
export interface DatabaseHandle {
  readonly label: string;
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
  transaction<T>(body: (handle: DatabaseHandle) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Open a PGlite database as a {@link DatabaseHandle}.
 */
async function openPGlite(path: string): Promise<DatabaseHandle> {
  ensureParentDirectory(path);
  const client = await PGlite.create(path, { parsers: pgliteDateParsers });

  const handle: DatabaseHandle = {
    label: `PGlite (${path})`,
    async query<Row>(text: string, params: readonly unknown[] = []) {
      const result = await client.query<Row>(text, [...params]);
      return { rows: result.rows };
    },
    async transaction<T>(body: (handle: DatabaseHandle) => Promise<T>): Promise<T> {
      return client.transaction(async (tx) => {
        const transactional: DatabaseHandle = {
          label: handle.label,
          async query<Row>(text: string, params: readonly unknown[] = []) {
            const result = await tx.query<Row>(text, [...params]);
            return { rows: result.rows };
          },
          transaction: async <Inner>(inner: (handle: DatabaseHandle) => Promise<Inner>) =>
            inner(transactional),
          close: async () => {},
        };
        return body(transactional);
      });
    },
    async close() {
      await client.close();
    },
  };

  return handle;
}

/**
 * Open a PostgreSQL server as a {@link DatabaseHandle}.
 *
 * A single pooled connection is used for the whole script so the
 * transaction runs on one session.
 */
async function openPostgres(url: string): Promise<DatabaseHandle> {
  const pool = new Pool({
    connectionString: url,
    max: 1,
    // Decode `date` columns as raw `YYYY-MM-DD` text so a calendar day
    // never shifts with the server's timezone (RPT-004, D-021).
    types: neonDateTypes,
  });

  const handle: DatabaseHandle = {
    label: `PostgreSQL at ${redactUrl(url)}`,
    async query<Row extends QueryResultRow>(text: string, params: readonly unknown[] = []) {
      const result = await pool.query<Row>(text, [...params]);
      return { rows: result.rows };
    },
    async transaction<T>(body: (handle: DatabaseHandle) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const transactional: DatabaseHandle = {
          label: handle.label,
          async query<Row extends QueryResultRow>(
            text: string,
            params: readonly unknown[] = [],
          ) {
            const result = await client.query<Row>(text, [...params]);
            return { rows: result.rows };
          },
          transaction: async <Inner>(inner: (handle: DatabaseHandle) => Promise<Inner>) =>
            inner(transactional),
          close: async () => {},
        };
        const outcome = await body(transactional);
        await client.query('COMMIT');
        return outcome;
      } catch (error) {
        // Roll back on any failure so a partial write never persists.
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };

  return handle;
}

/**
 * Open the configured target database.
 */
export async function openDatabase(
  target: DatabaseTarget = resolveDatabaseTarget(),
): Promise<DatabaseHandle> {
  return target.kind === 'pglite' ? openPGlite(target.path) : openPostgres(target.url);
}
