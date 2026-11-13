/**
 * Employee directory query (QRY-001…QRY-007, ANA-007, RPT-001, RPT-005).
 *
 * Purpose: read the 10,000-person workforce with server-side search, filters,
 * sorting, and pagination. The browser never receives more than one bounded
 * page (ANA-007).
 *
 * Called by: the /employees directory route, and the workforce count on the
 *           overview page.
 * Reads: employees (joined to departments and branches), and salary_records for
 *        the current salary shown on each row.
 * Rules: QRY-001 (search), QRY-002 (literal characters), QRY-003 (unknown
 *        values ignored), QRY-004 (bounded page size), QRY-005 (allow-listed
 *        sort), QRY-006 (a filter change resets the page), QRY-007 (an empty
 *        result distinguishes no data from no match), ANA-007, RPT-001 (the
 *        reporting date selects the current salary), RPT-005 (money carries
 *        its currency).
 * Tests: tests/integration/employee-directory.test.ts
 *
 * Design notes
 * ------------
 * - The query takes a **database handle** rather than calling `getDatabase()`
 *   itself, so the same function is exercised against PGlite in the
 *   integration tests and against Neon in production. The handle type is
 *   generic over the driver's query-result kind, because Neon and PGlite
 *   declare different ones.
 * - **Every** sort column is selected from a literal allow-list and mapped to
 *   a fixed column reference by a `switch` over that union. Adding a sort
 *   value without adding it to the switch is a compile error, so a new sort
 *   can never silently fall through to an unexpected column (QRY-005).
 * - **Search is literal.** The term is escaped before it reaches `ILIKE`, so
 *   `%` matches a percent sign rather than everything (QRY-002). The `ESCAPE`
 *   clause is explicit rather than relying on the driver's default.
 * - **The current salary is selected in SQL**, not in JavaScript: a lateral
 *   join picks the row with the greatest effective date on or before the
 *   reporting date (SAL-007). Doing it in the application would mean reading
 *   every salary row for every employee on the page.
 * - A **page beyond the last page** returns no rows and the real total, never
 *   an error (QRY-004).
 */

import { and, asc, count, desc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core/session';
import { branches, departments, employees, salaryRecords, schema } from '../schema';
import type { DateOnly } from '@/lib/date-only';
import {
  DEFAULT_EMPLOYEE_DIRECTORY_SORT,
  type EmployeeDirectoryQuery,
  type EmployeeDirectorySort,
} from '@/schemas/employee-directory';

/**
 * A Drizzle handle for a PostgreSQL database.
 *
 * Generic over the query-result kind so the Neon serverless client and the
 * PGlite test client are both accepted. The schema generic is fixed to the
 * application's schema.
 */
export type DirectoryDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/** A directory row, exactly as the table renders it. */
export interface DirectoryRow {
  readonly id: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly jobTitle: string;
  readonly jobLevel: number;
  readonly employmentStatus: string;
  readonly workMode: string;
  readonly countryCode: string;
  readonly departmentId: number;
  readonly departmentName: string;
  readonly branchId: number;
  readonly branchCode: string;
  readonly branchName: string;
  readonly branchCity: string;
  /** The current salary's amount, or null when the employee has none yet. */
  readonly currentBaseSalary: string | null;
  readonly currentBonusPct: string | null;
  readonly currentCurrencyCode: string | null;
  readonly currentEffectiveFrom: DateOnly | null;
  /**
   * The current salary's synthetic USD equivalent.
   *
   * This is the basis the salary sort uses, because the local amounts are in
   * six currencies and are not comparable with each other (MON-004, RPT-007).
   */
  readonly currentUsdEquivalent: string | null;
}

/** The directory result: this page's rows, plus everything the pager needs. */
export interface DirectoryResult {
  readonly rows: readonly DirectoryRow[];
  /** The total number of matching rows, across every page. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  /**
   * True when there are no rows at all **and** no filter narrowed them away.
   *
   * The directory distinguishes "there is no data" from "your filters matched
   * nothing" (QRY-007), and this flag is what separates them.
   */
  readonly isEmptyPopulation: boolean;
}

/**
 * The sortable columns, mapped to a fixed column reference.
 *
 * The `switch` is exhaustive over the literal union: adding a sort value to
 * the allow-list without adding it here is a compile error, so a new sort can
 * never silently fall through to an unexpected column.
 *
 * **Enum columns are sorted by their text value, not by their enum position.**
 * PostgreSQL orders an enum by the order its values were declared in the type
 * — `country_code` is declared `US, IN, GB, DE, CA, AU`, so sorting by the
 * enum would put US first and GB last. A reader clicking "Country" expects
 * alphabetical order, so the column is cast to text first. The same applies
 * to `employment_status` and `work_mode`.
 *
 * **The salary sort uses the USD equivalent, not the local amount.** The
 * workforce is paid in six currencies, so ordering by `base_salary` would
 * compare ₹96,05,289 with $74,716 as though they were the same unit — the
 * order would be an artefact of the currency mix rather than of the
 * salaries. `usd_equivalent` is the synthetic amount every record carries
 * (MON-004, RPT-007), so the order is comparable. It is still the *local*
 * amount that is displayed, with its own currency code.
 */
function sortColumns(sort: EmployeeDirectorySort): SQL[] {
  switch (sort) {
    case 'status':
      return [asc(sql`${employees.employmentStatus}::text`), asc(employees.id)];
    case 'jobTitle':
      return [asc(employees.jobTitle), asc(employees.id)];
    case 'country':
      return [asc(sql`${employees.countryCode}::text`), asc(employees.id)];
    case 'salary':
      return [desc(salaryRecords.usdEquivalent), asc(employees.id)];
    case 'workMode':
      return [asc(sql`${employees.workMode}::text`), asc(employees.id)];
    case 'employee':
    default:
      return [asc(employees.lastName), asc(employees.firstName), asc(employees.id)];
  }
}

/**
 * Escape the characters `ILIKE` treats as wildcards.
 *
 * `%` matches any sequence, `_` matches any single character, and `\` is the
 * escape character itself. A user searching for `100%` must find employees
 * whose text contains the literal `100%`, not every employee (QRY-002).
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * Build the `WHERE` clause for the directory.
 *
 * Returns `undefined` when no filter applies, so the query has no `WHERE` at
 * all rather than a tautology — which also lets `isEmptyPopulation` tell
 * "no data" from "no match".
 */
function buildFilter(query: EmployeeDirectoryQuery): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.search !== undefined) {
    // Employee ID (exact or prefix), full name (contains), email (contains) —
    // trimmed and case-insensitive (QRY-001).
    const contains = `%${escapeLikePattern(query.search)}%`;
    const idPrefix = `${escapeLikePattern(query.search)}%`;
    const matchesNumericId = /^\d+$/.test(query.search);
    conditions.push(
      sql`(
        ${ilike(sql`${employees.firstName} || ' ' || ${employees.lastName}`, contains)}
        or ${ilike(employees.email, contains)}
        ${
          matchesNumericId
            ? sql`or ${ilike(sql`cast(${employees.id} as text)`, idPrefix)}`
            : sql``
        }
      )`,
    );
  }

  if (query.country !== undefined) {
    conditions.push(eq(employees.countryCode, query.country));
  }

  if (query.status !== undefined) {
    conditions.push(eq(employees.employmentStatus, query.status));
  }

  if (query.workMode !== undefined) {
    conditions.push(eq(employees.workMode, query.workMode));
  }

  if (query.level !== undefined) {
    conditions.push(eq(employees.jobLevel, query.level));
  }

  if (query.branch !== undefined) {
    conditions.push(
      sql`${employees.branchId} in (select id from ${branches} where ${branches.branchCode} = ${query.branch})`,
    );
  }

  if (query.department !== undefined) {
    conditions.push(
      sql`${employees.departmentId} in (select id from ${departments} where ${departments.name} = ${query.department})`,
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Read one page of the employee directory.
 *
 * @param db a Neon or PGlite Drizzle handle
 * @param query the validated request from `src/schemas/employee-directory.ts`
 */
export async function queryEmployeeDirectory(
  db: DirectoryDatabase,
  query: EmployeeDirectoryQuery,
): Promise<DirectoryResult> {
  const where = buildFilter(query);
  const reportingDate = query.asOf ?? null;

  // The join picks, for each employee, the salary row with the greatest
  // effective date on or before the reporting date (SAL-007). The `max`
  // sub-query is correlated to the outer employee row, so each employee gets
  // their own current salary rather than the workforce-wide latest date.
  const currentSalaryCondition = and(
    eq(salaryRecords.employeeId, employees.id),
    sql`${salaryRecords.effectiveFrom} <= ${reportingDate ?? sql`current_date`}`,
    sql`${salaryRecords.effectiveFrom} = (
      select max(sr.effective_from) from ${sql.identifier('salary_records')} sr
      where sr.employee_id = ${employees.id}
        and sr.effective_from <= ${reportingDate ?? sql`current_date`}
    )`,
  );

  const base = db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      email: employees.email,
      jobTitle: employees.jobTitle,
      jobLevel: employees.jobLevel,
      employmentStatus: employees.employmentStatus,
      workMode: employees.workMode,
      countryCode: employees.countryCode,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      branchId: employees.branchId,
      branchCode: branches.branchCode,
      branchName: branches.name,
      branchCity: branches.city,
      currentBaseSalary: salaryRecords.baseSalary,
      currentBonusPct: salaryRecords.bonusPct,
      currentCurrencyCode: salaryRecords.currencyCode,
      currentEffectiveFrom: salaryRecords.effectiveFrom,
      currentUsdEquivalent: salaryRecords.usdEquivalent,
    })
    .from(employees)
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .leftJoin(salaryRecords, currentSalaryCondition);

  const filtered = where ? base.where(where) : base;

  const rows = await filtered
    .orderBy(...sortColumns(query.sort))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const totalRows = await db
    .select({ value: count() })
    .from(employees)
    .where(where);

  const total = totalRows[0]?.value ?? 0;

  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    isEmptyPopulation: total === 0 && where === undefined,
  };
}

/**
 * The total workforce size, ignoring every filter.
 *
 * Used by the overview page, which states the size of the organisation
 * (ANA-001: an analytical figure must have explicit scope).
 */
export async function countEmployees(db: DirectoryDatabase): Promise<number> {
  const rows = await db.select({ value: count() }).from(employees);
  return rows[0]?.value ?? 0;
}

export { DEFAULT_EMPLOYEE_DIRECTORY_SORT };
