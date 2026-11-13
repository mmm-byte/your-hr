import 'server-only';

/**
 * Environment variables (ENVIRONMENT.md §4).
 *
 * Validated at the point of use, not at import time. Import-time validation
 * would make the whole application fail to build when a variable is missing,
 * which breaks `next build` in environments that have no database — such as CI
 * running lint and unit tests.
 *
 * The failure is loud and explicit: a missing `DATABASE_URL` must never fall
 * back to a hard-coded credential.
 */

export interface ServerEnv {
  /**
   * The Neon connection string.
   *
   * Optional when `PGLITE_PATH` names a local database, because the local
   * target needs no server and no credential.
   */
  readonly DATABASE_URL?: string;
  readonly DATABASE_URL_UNPOOLED?: string;
  readonly NEXT_PUBLIC_APP_URL?: string;
  /**
   * A local PGlite database, used instead of the Neon pool when set.
   *
   * The operational scripts already accept this path (scripts/README.md), so
   * the application and the scripts can share one local target.
   */
  readonly PGLITE_PATH?: string;
}

/**
 * Read and validate the server environment.
 *
 * Called lazily by the modules that need it, so an application that does not
 * touch the database can still build.
 */
export function getServerEnv(): ServerEnv {
  const pglitePath = process.env.PGLITE_PATH?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!pglitePath && !databaseUrl) {
    throw new Error(
      'No database target configured. Set DATABASE_URL for a PostgreSQL server, ' +
        'or PGLITE_PATH for a local PGlite database. ' +
        'See .env.example.',
    );
  }

  return {
    DATABASE_URL: databaseUrl,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    PGLITE_PATH: pglitePath,
  };
}

/**
 * The validated environment, resolved lazily on first property access.
 */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, property: string) {
    return getServerEnv()[property as keyof ServerEnv];
  },
});
