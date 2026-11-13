/**
 * Employee directory request schema (QRY-001…QRY-007, ANA-007, RPT-003).
 *
 * Purpose: validate the employee directory's untrusted query string before it
 * reaches the database. Every input is either **bounded** or **allow-listed**,
 * so a hand-edited URL can never turn into an unbounded query or an injected
 * column name.
 *
 * Called by: src/db/queries/employees.ts and the /employees route.
 * Reads: nothing — pure validation, no I/O and no database access.
 * Rules: QRY-001 (search), QRY-002 (literal characters), QRY-003 (unknown
 *        values ignored), QRY-004 (bounded page size), QRY-005 (allow-listed
 *        sort), QRY-006 (filter change resets the page), ANA-007
 *        (server-side filtering over 10,000 employees), RPT-003 (filters and
 *        reporting date live in the URL).
 * Tests: tests/unit/employee-directory-schema.test.ts
 *
 * Design notes
 * ------------
 * - The allow-lists come from `@/lib/domain-values`, which is also the source
 *   of the PostgreSQL enum types. A filter value that the database column
 *   cannot hold is therefore rejected before the query is built.
 * - Every field ends in `.catch(...)`, so `safeParse` never fails because of a
 *   bad query parameter. An unrecognised value is **ignored in favour of the
 *   documented default** and is never an error (QRY-003). The one thing that
 *   *is* an error — a completely absent or non-object input — still fails.
 * - `asOf` is validated as a **real calendar day**, not merely a
 *   `YYYY-MM-DD` shape. `2026-02-30` is not a date, and accepting it would
 *   silently resolve to a different day (RPT-004).
 */

import { z } from 'zod';
import { isDateOnly, todayDateOnly } from '@/lib/date-only';
import {
  branchSchema,
  countrySchema,
  departmentSchema,
  levelSchema,
  pageSchema,
  pageSizeSchema,
  queryString,
  searchSchema,
  statusSchema,
  workModeSchema,
} from './query-params';

/**
 * The sortable directory columns.
 *
 * These mirror the visible column order in the directory table: Employee,
 * Status, Job title + level, Country / Branch, Current salary, Work mode.
 *
 * `employee` is the default because it is the only ordering that is stable
 * for every workforce — the name is unique enough to break ties and does not
 * depend on a salary record existing.
 */
export const EMPLOYEE_DIRECTORY_SORTS = [
  'employee',
  'status',
  'jobTitle',
  'country',
  'salary',
  'workMode',
] as const;

export type EmployeeDirectorySort = (typeof EMPLOYEE_DIRECTORY_SORTS)[number];

/** The default sort, used when the request omits `sort` or names an unknown one. */
export const DEFAULT_EMPLOYEE_DIRECTORY_SORT: EmployeeDirectorySort = 'employee';

/**
 * The sort column.
 *
 * An unrecognised value falls back to the documented default sort rather than
 * failing the request (QRY-005). The fallback is deterministic, so two
 * requests with the same bad value produce the same order.
 */
const sortSchema = z.preprocess(
  queryString,
  z.enum(EMPLOYEE_DIRECTORY_SORTS).catch(DEFAULT_EMPLOYEE_DIRECTORY_SORT),
);

/**
 * The reporting date, as a `YYYY-MM-DD` calendar day.
 *
 * The value is optional; when it is absent the caller uses the server's
 * current calendar date (RPT-001). It is validated as a real day, so
 * `2026-02-30` is rejected rather than silently shifted.
 *
 * A **future** date is also rejected. The product asks what a person earned
 * as of a date, so the future is not a meaningful answer, and the date control
 * does not offer it. Accepting one would put the control into a state the
 * browser itself reports as invalid, with no explanation on the page.
 */
const asOfSchema = z.preprocess(
  queryString,
  z
    .string()
    .refine((value) => isDateOnly(value), { message: 'Enter a valid reporting date.' })
    .refine((value) => value <= todayDateOnly(), {
      message: 'The reporting date cannot be in the future.',
    })
    .optional()
    .catch(undefined),
);

/**
 * The validated employee directory request.
 *
 * Every filter is `undefined` when it was not supplied or not recognised, so
 * the query layer can treat "no filter" and "an ignored filter" identically.
 */
export const employeeDirectoryQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  search: searchSchema,
  country: countrySchema,
  branch: branchSchema,
  department: departmentSchema,
  level: levelSchema,
  status: statusSchema,
  workMode: workModeSchema,
  sort: sortSchema,
  asOf: asOfSchema,
});

export type EmployeeDirectoryQuery = z.infer<typeof employeeDirectoryQuerySchema>;

/**
 * Parse a raw query string into a validated directory request.
 *
 * Returns `null` only when the input is not a query object at all. Every
 * individual field degrades to its documented default.
 */
export function parseEmployeeDirectoryQuery(
  raw: unknown,
): EmployeeDirectoryQuery | null {
  const result = employeeDirectoryQuerySchema.safeParse(raw);
  return result.success ? result.data : null;
}
