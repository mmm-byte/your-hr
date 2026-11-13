/**
 * Driver-level date parsers that keep `date` columns timezone-stable (RPT-004).
 *
 * Purpose: return a PostgreSQL `date` column as its raw `YYYY-MM-DD` text so
 * the calendar day can never shift when the value crosses a timezone.
 * Called by: src/db/client.ts (Neon pool), scripts/target.ts (PGlite and Neon),
 *            tests/setup/integration.ts and tests/integration/seed.test.ts.
 * Reads: nothing — this module only describes how the drivers decode a type.
 * Rules: RPT-004, DATABASE.md (dates are `date`, not `timestamptz`),
 *        D-021.
 * Tests: tests/unit/date-parsers.test.ts, tests/integration/date-parsers.test.ts.
 *
 * Why a custom parser is required
 * -------------------------------
 * PostgreSQL's `date` type is a calendar day with no time and no zone. The
 * built-in parsers disagree about what that means:
 *
 * - Neon (`@neondatabase/serverless`) decodes `date` into a JavaScript `Date`
 *   built from **local** midnight, so the instant depends on the server's
 *   `TZ`. Drizzle's string mode then re-slices that instant in UTC
 *   (`value.toISOString().slice(0, -14)`), which lands on the **previous** day
 *   for every deployment east of UTC.
 * - PGlite decodes `date` into UTC midnight, which happens to be correct.
 *
 * The result is a defect that is invisible in local tests and silently wrong
 * in production: a hire date of `2023-05-09` reads back as `2023-05-08` from
 * a server running in IST, London, or Berlin.
 *
 * The fix is to stop the drivers from constructing a `Date` at all. A custom
 * parser returns the raw text, Drizzle's string mode passes strings through
 * unchanged, and no timezone conversion ever happens.
 *
 * Only OID 1082 (`date`) is overridden. `timestamptz` (1184) and `timestamp`
 * (1114) are absolute instants and are deliberately left to the drivers.
 */
import { types as pgTypes } from '@neondatabase/serverless';

/**
 * Type parsers keyed by PostgreSQL type OID.
 *
 * Structurally identical to PGlite's `ParserOptions`, declared locally so
 * this module — which lives under `src/` and is bundled by the application —
 * does not depend on a dev-only package's type exports.
 */
export type DateTypeParsers = Record<number, (value: string) => unknown>;

/** The PostgreSQL type OID for `date`. */
export const PG_DATE_OID = 1082;

/**
 * Decode a `date` column as its raw `YYYY-MM-DD` text.
 *
 * The value is passed through untouched: PostgreSQL already formats a `date`
 * as an ISO calendar day, and any further parsing would reintroduce a zone.
 */
export function parseDateOnly(value: string): string {
  return value;
}

/**
 * Type parsers for PGlite, keyed by PostgreSQL type OID.
 *
 * PGlite applies these before its own built-in parsers, so `date` columns
 * arrive as strings exactly as they do from Neon.
 */
export const pgliteDateParsers: DateTypeParsers = {
  [PG_DATE_OID]: parseDateOnly,
};

/**
 * The Neon `types` configuration that overrides only the `date` parser.
 *
 * Every other type falls back to the driver's bundled `pg-types` parser, so
 * `numeric` still arrives as an exact decimal string and `timestamptz` still
 * arrives as a correct instant. Neon applies this to the text and the binary
 * protocol alike.
 */
export const neonDateTypes = {
  getTypeParser(id: number, format?: 'text' | 'binary') {
    if (id === PG_DATE_OID) {
      return parseDateOnly;
    }
    return pgTypes.getTypeParser(id, format);
  },
};