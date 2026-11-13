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
  readonly DATABASE_URL: string;
  readonly DATABASE_URL_UNPOOLED?: string;
  readonly NEXT_PUBLIC_APP_URL?: string;
}

function requireValue(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Set it in .env.local for development, or in the deployment environment. ' +
        'See .env.example.',
    );
  }
  return value;
}

/**
 * Read and validate the server environment.
 *
 * Called lazily by the modules that need it, so an application that does not
 * touch the database can still build.
 */
export function getServerEnv(): ServerEnv {
  return {
    DATABASE_URL: requireValue('DATABASE_URL', process.env.DATABASE_URL),
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
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
