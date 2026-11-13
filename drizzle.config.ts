import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration (ENVIRONMENT.md → `drizzle/` holds generated
 * migrations committed to Git).
 *
 * Purpose: tell drizzle-kit where the schema lives and where to write
 * migrations. It is used only by `pnpm db:generate`; applying migrations is
 * handled by scripts/migrate.ts.
 * Reads: src/db/schema.ts.
 * Rules: the generated SQL is the schema source of truth for both Neon and
 *        the PGlite integration database (D-009).
 *
 * `casing: 'snake_case'` makes drizzle-kit emit snake_case SQL for camelCase
 * TypeScript properties, so the column names match the names documented in
 * docs/DATABASE.md without hand-writing every mapping.
 *
 * The connection string is read from the environment and is never committed.
 * `db:generate` does not need a live database, but drizzle-kit still
 * validates the config, so a placeholder is used when the variable is unset.
 */
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://localhost/your-hr';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
