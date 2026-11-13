/**
 * Shared primitives for server-boundary query parameters (QRY-003, QRY-005).
 *
 * Purpose: one definition of how a raw URL query value becomes a typed,
 * bounded value. Every schema in this folder uses these, so a rule such as
 * "an unrecognised value is ignored, never an error" is applied identically
 * everywhere instead of being re-implemented per schema.
 *
 * Called by: src/schemas/employee-directory.ts, src/schemas/compensation-analytics.ts
 * Reads: nothing — pure functions, no I/O and no database access.
 * Rules: QRY-003 (unknown values ignored), QRY-004 (bounded page size),
 *        QRY-005 (allow-listed sort).
 * Tests: tests/unit/query-params.test.ts
 *
 * Design notes
 * ------------
 * - **No silent coercion.** `z.coerce.number()` turns `true` into `1` and `[]`
 *   into `0`, so a malformed query parameter would quietly become a valid
 *   filter value. These preprocessors return `undefined` for anything they do
 *   not understand, and the schema's `.catch()` then applies the documented
 *   default. Nothing is ever reinterpreted.
 * - A repeated parameter (`?country=US&country=IN`) takes the **first** value.
 *   The contract does not define multi-value filters, so one deterministic
 *   answer is better than an ambiguous one.
 */

import { z } from 'zod';
import {
  BRANCH_CODES,
  COUNTRY_CODES,
  DEPARTMENT_NAMES,
  EMPLOYMENT_STATUSES,
  JOB_LEVELS,
  WORK_MODES,
} from '@/lib/domain-values';

/** The default page size for every paginated list (docs/PERFORMANCE.md). */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * The hard cap on rows returned by one request.
 *
 * A request that asks for more is **clamped**, never rejected (QRY-004,
 * docs/PERFORMANCE.md → "Server-side page size cap").
 */
export const MAX_PAGE_SIZE = 100;

/** Take the first value when a parameter was repeated. */
function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Read a query parameter as an integer.
 *
 * Accepts a `number` that is already a safe integer, or a string of digits
 * with an optional sign. `'007'` is `7`; `' 25 '` is `25`. Everything else —
 * `'abc'`, `'50.5'`, `true`, `''`, a value beyond `Number.MAX_SAFE_INTEGER` —
 * is `undefined`, which the schema turns into its documented default.
 */
export function queryInteger(value: unknown): number | undefined {
  const raw = firstValue(value);

  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) ? raw : undefined;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }

  return undefined;
}

/**
 * Read a query parameter as a trimmed string.
 *
 * An empty or whitespace-only value is `undefined` — it carries no meaning
 * and is treated as "not supplied", not as a search for a blank string.
 */
export function queryString(value: unknown): string | undefined {
  const raw = firstValue(value);
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * A 1-based page number.
 *
 * A page below 1, a non-integer, or an unparseable value falls back to the
 * first page. A page **beyond** the last page is not an error either — it
 * returns an empty result set with the real total (QRY-004).
 */
export const pageSchema = z.preprocess(queryInteger, z.number().int().min(1).catch(1));

/**
 * A bounded page size.
 *
 * Default 25, maximum 100. A larger request is clamped to the cap rather than
 * rejected, so a stale bookmark or a hand-edited URL still produces a usable
 * page (QRY-004).
 */
export const pageSizeSchema = z
  .preprocess(queryInteger, z.number().int().min(1).catch(DEFAULT_PAGE_SIZE))
  .transform((value) => Math.min(value, MAX_PAGE_SIZE));

/**
 * A free-text search term.
 *
 * Trimmed, case-insensitive at the query layer, and matched literally: `%`,
 * `_`, `'` and `\` are ordinary characters, never SQL wildcards (QRY-001,
 * QRY-002). The length bound stops an unbounded term reaching the database.
 */
export const searchSchema = z.preprocess(
  queryString,
  z.string().max(100).optional().catch(undefined),
);

/**
 * The shared allow-list filters.
 *
 * The compensation and analytics surfaces use the **same** filter model as the
 * directory, so the allow-lists live here rather than being restated per
 * schema. Two copies of an allow-list would drift, and a filter that the
 * directory accepts but analytics rejects would be a confusing inconsistency.
 *
 * Every one of these ignores an unrecognised value in favour of "no filter"
 * rather than failing the request (QRY-003).
 */

/** A country filter. */
export const countrySchema = z.preprocess(
  queryString,
  z.enum(COUNTRY_CODES).optional().catch(undefined),
);

/** A branch filter, allow-listed against the eight branches in the cohort. */
export const branchSchema = z.preprocess(
  queryString,
  z.enum(BRANCH_CODES).optional().catch(undefined),
);

/** A department filter, allow-listed against the forty departments. */
export const departmentSchema = z.preprocess(
  queryString,
  z.enum(DEPARTMENT_NAMES).optional().catch(undefined),
);

/** An employment status filter. */
export const statusSchema = z.preprocess(
  queryString,
  z.enum(EMPLOYMENT_STATUSES).optional().catch(undefined),
);

/** A work mode filter. */
export const workModeSchema = z.preprocess(
  queryString,
  z.enum(WORK_MODES).optional().catch(undefined),
);

/**
 * A job level filter.
 *
 * The level arrives as text in a query string, so it is read as an integer
 * first and then matched against the allow-list. `z.literal` alone would
 * reject the string `'3'`.
 */
export const levelSchema = z.preprocess(
  queryInteger,
  z.literal(JOB_LEVELS).optional().catch(undefined),
);
