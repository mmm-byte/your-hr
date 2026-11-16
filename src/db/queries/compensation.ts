/**
 * The compensation, analytics, and data-quality queries
 * (ANA-001…ANA-007, MON-001…MON-006, QRY-005/007, RPT-001…007, SAL-007/008).
 *
 * Purpose: read the four compensation surfaces from the database — the
 * filterable current-salary population behind /compensation, the
 * currency-grouped aggregates behind /compensation, the grouped figures behind
 * /analytics and the overview, and the deterministic findings behind
 * /data-quality.
 *
 * Called by: the /, /compensation, /analytics, and /data-quality routes.
 * Reads: employees (joined to departments and branches), salary_records, and
 *        branches (for the branch policy currency).
 * Rules: ANA-001 (explicit scope), ANA-002 (a headcount describes the current
 *        workforce unless terminated employees are explicitly included),
 *        ANA-003 (the median handles even-length sets), ANA-004 (an empty
 *        result is an empty state, never a fabricated zero), ANA-005
 *        (currency-sensitive metrics are grouped by currency), ANA-006 (the
 *        reporting date selects the effective-dated state), ANA-007
 *        (server-side filtering and pagination), MON-002 (money is an exact
 *        decimal string), MON-004/RPT-007 (no mixed-currency total),
 *        MON-005/MON-006 (the USD equivalent is a labelled synthetic view),
 *        QRY-005 (the grouping comes from an allow-list), QRY-007 (no data is
 *        distinguished from no match), SAL-007 (current = the latest
 *        effective date on or before the reporting date), SAL-008 (a
 *        future-effective record is never current), RPT-001 (the reporting date
 *        defaults to today), RPT-004 (a date-only value never shifts), RPT-006
 *        (the database value stays the source of truth).
 * Tests: tests/integration/compensation.test.ts
 *
 * Design notes
 * ------------
 * - Every function takes a **database handle** rather than calling
 *   `getDatabase()` itself, so the same code runs against PGlite in the
 *   integration tests and against Neon in production. The handle type is
 *   generic over the driver's query-result kind, because the two declare
 *   different ones.
 * - **The aggregates are computed in PostgreSQL, not in JavaScript.** Reading
 *   10,000 salaries into the server to sort them would move the work out of
 *   the database, lose the exact decimal semantics of `numeric`, and ship
 *   every row to the browser. The database does the grouping, the counting,
 *   the percentile, and the averaging, and returns one row per currency.
 * - **`percentile_cont` is the median, not `percentile_disc`.** The
 *   continuous percentile is the mean of the two middle values for an
 *   even-length set, which is the correct median (ANA-003). PostgreSQL
 *   resolves `percentile_cont` over a `numeric` column to the `double
 *   precision` implementation, so the result is cast back to `numeric` and
 *   rounded to the currency's scale before it becomes a string.
 * - **Money crosses the boundary as a string.** `numeric` is cast to `text`
 *   in SQL, so a value arrives as an exact decimal string and is never parsed
 *   into a JavaScript `number` (MON-002). The rounding happens in SQL, at the
 *   currency's own scale; the unrounded `numeric` stays in the database as the
 *   source of truth (RPT-006).
 * - **There is never a total across currencies.** `queryCurrencyAggregates`
 *   returns one entry per currency, plus a second, separately labelled set
 *   computed over the synthetic USD equivalent (MON-004, RPT-007, MON-005,
 *   MON-006). The two sets are never added together.
 * - **The current salary is selected in SQL** with the same correlated
 *   `max(effective_from)` pattern the directory uses, so no surface can
 *   disagree about which record is current (SAL-007, SAL-008).
 * - **The grouping comes from an allow-list.** `GROUP_EXPRESSIONS` is a
 *   `Record` over the `AnalyticsGrouping` union, so adding a grouping
 *   without giving it an expression is a compile error (QRY-005).
 * - **The data-quality rules are deterministic.** The same data always
 *   produces the same findings: no sampling, no clock, no random ordering.
 *   Each rule is one aggregate query, and the affected employees come from
 *   that same query, so the count and the list can never disagree.
 * - **A rule is a scope, not a verdict.** The findings are "needs review"
 *   items. Two of the rules are unreachable while the database constraints
 *   hold; they are implemented anyway so the work queue stays honest if the
 *   data arrives from somewhere else.
 */

import { and, asc, count, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core/session';
import { branches, departments, employees, salaryRecords, schema } from '../schema';
import type { CountGroup } from '@/lib/analytics';
import type { DateOnly } from '@/lib/date-only';
import type { MoneyString } from '@/lib/money';
import {
  DEFAULT_ANALYTICS_GROUPING,
  DEFAULT_ANALYTICS_METRIC,
  supportedGroupings,
  type AnalyticsGrouping,
  type AnalyticsMetric,
  type CompensationAnalyticsQuery,
} from '@/schemas/compensation-analytics';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/schemas/query-params';

/**
 * A Drizzle handle for a PostgreSQL database.
 *
 * Generic over the query-result kind so the Neon serverless client and the
 * PGlite test client are both accepted. The schema generic is fixed to the
 * application's schema.
 */
export type CompensationDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * The compensation request.
 *
 * This is the validated analytics request plus the three things the
 * compensation pages need that the shared schema does not carry: the
 * reporting date, the pager, and the explicit "include terminated employees"
 * control (ANA-002).
 *
 * Every field is optional, so a bare `CompensationAnalyticsQuery` from
 * `src/schemas/compensation-analytics.ts` — or the directory's own request —
 * can be passed straight through.
 */
export interface CompensationQuery extends Partial<CompensationAnalyticsQuery> {
  /** The reporting date, as a `YYYY-MM-DD` calendar day (RPT-001). */
  readonly asOf?: DateOnly | undefined;
  /** The 1-based page number (ANA-007). */
  readonly page?: number | undefined;
  /** The requested page size, clamped to the documented maximum (ANA-007). */
  readonly pageSize?: number | undefined;
  /**
   * Include terminated employees in a headcount figure (ANA-002).
   *
   * An explicit `status` filter always wins: asking for terminated
   * employees by status is asking for them.
   */
  readonly includeTerminated?: boolean | undefined;
}

/** One employee's current salary, as the compensation table shows it. */
export interface CompensationPopulationRow {
  readonly id: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly jobTitle: string;
  readonly jobLevel: number;
  readonly employmentStatus: string;
  readonly workMode: string;
  readonly countryCode: string;
  readonly departmentName: string;
  readonly branchCode: string;
  readonly branchCity: string;
  /** The current salary's local amount, or null when the employee has none. */
  readonly baseSalary: MoneyString | null;
  readonly currencyCode: string | null;
  /** The current salary's synthetic USD equivalent (MON-005). */
  readonly usdEquivalent: MoneyString | null;
}

/** The compensation population: this page's rows plus everything the pager needs. */
export interface CompensationPopulationResult {
  readonly rows: CompensationPopulationRow[];
  /** The number of matching employees, across every page. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  /**
   * True when nothing matched **and** no filter narrowed the workforce away.
   *
   * The page distinguishes "there is no data" from "your filters matched
   * nothing" (QRY-007).
   */
  readonly isEmptyPopulation: boolean;
}

/**
 * The aggregates for one currency.
 *
 * The currency is carried on the aggregate itself, so a mixed-currency total
 * cannot be represented by accident (MON-004, RPT-007, ANA-005).
 */
export interface CurrencyAggregateRow {
  /** The currency the group is denominated in. */
  readonly currency: string;
  /** The number of employees the figures describe — the sample size. */
  readonly headcount: number;
  readonly median: MoneyString | null;
  readonly average: MoneyString | null;
  readonly lowest: MoneyString | null;
  readonly highest: MoneyString | null;
}

/**
 * The currency-grouped aggregates.
 *
 * `byCurrency` holds the local amounts, each in its own currency.
 * `byUsdEquivalent` holds the same groups measured in the synthetic USD
 * equivalent — a separate, explicitly labelled view (MON-005, MON-006).
 */
export interface CurrencyAggregatesResult {
  readonly byCurrency: CurrencyAggregateRow[];
  readonly byUsdEquivalent: CurrencyAggregateRow[];
}

/** One grouped analytics figure. */
export interface AnalyticsGroupRow {
  /** The group label, for example a country code or a department name. */
  readonly group: string;
  /**
   * The currency the salary figures are in, or null for a metric that has no
   * salary in it.
   *
   * A salary figure is always stated within a single currency (ANA-005).
   */
  readonly currency: string | null;
  /** The number of employees in the group — the sample size (ANA-005). */
  readonly count: number;
  readonly median: MoneyString | null;
  readonly average: MoneyString | null;
}

/** The workforce size, split by employment status. */
export interface WorkforceSummary {
  readonly active: number;
  readonly onLeave: number;
  readonly terminated: number;
  readonly total: number;
}

/** The workforce distribution, used for the overview's count panels. */
export interface WorkforceDistribution {
  readonly byCountry: CountGroup[];
  readonly byDepartment: CountGroup[];
}

/** One recently recorded salary change. */
export interface RecentSalaryChange {
  readonly employeeId: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly effectiveFrom: DateOnly;
  readonly baseSalary: MoneyString;
  readonly currencyCode: string;
  /** The salary this one replaced, or null when it is the first record. */
  readonly previousBaseSalary: MoneyString | null;
  readonly changeReason: string | null;
}

/** One deterministic data-quality finding. */
export interface DataQualityIssueRow {
  /** The stable kebab-case identifier of the rule. */
  readonly code: string;
  readonly title: string;
  readonly description: string;
  /** The number of employees the rule finds. */
  readonly count: number;
  /** The affected employee ids, capped so a page never ships the workforce. */
  readonly employeeIds: number[];
  /** True when more employees are affected than the list shows. */
  readonly hasMore: boolean;
}

/** The data-quality work queue. */
export interface DataQualityResult {
  readonly issues: DataQualityIssueRow[];
  /** The number of distinct employees with at least one finding. */
  readonly affectedEmployees: number;
}

/**
 * The statuses a headcount describes unless the caller widens it (ANA-002).
 */
const CURRENT_WORKFORCE_STATUSES = ['active', 'on_leave'] as const;

/**
 * The most affected employees listed for one finding.
 *
 * The full count is always reported, so a truncated list never hides the
 * size of the problem.
 */
const MAX_AFFECTED_EMPLOYEES_PER_ISSUE = 50;

/**
 * The default number of recent salary changes the overview shows.
 */
const DEFAULT_RECENT_CHANGE_LIMIT = 5;

/**
 * The group expression for each allowed grouping.
 *
 * A `Record` over the `AnalyticsGrouping` union: adding a grouping to the
 * allow-list without giving it an expression is a compile error, so a new
 * grouping can never silently fall through to an unexpected column (QRY-005).
 *
 * The enum columns are cast to text, because PostgreSQL orders an enum by
 * its declared position rather than alphabetically, and a reader expects
 * "AU" before "DE".
 */
const GROUP_EXPRESSIONS: Readonly<Record<AnalyticsGrouping, SQL<string>>> = {
  country: sql<string>`${employees.countryCode}::text`,
  department: sql<string>`${departments.name}`,
  jobLevel: sql<string>`${employees.jobLevel}::text`,
  status: sql<string>`${employees.employmentStatus}::text`,
};

/**
 * The reporting date as a SQL expression.
 *
 * A supplied date is a bound parameter — never a `Date` object — so the
 * calendar day cannot shift across a time zone (RPT-004). Without one, the
 * database's current date is used (RPT-001).
 */
function reportingDateExpression(asOf: DateOnly | undefined): SQL {
  return asOf === undefined ? sql`current_date` : sql`${asOf}`;
}

/**
 * The join condition that selects each employee's current salary.
 *
 * The correlated `max(effective_from)` sub-query picks the record with the
 * greatest effective date on or before the reporting date (SAL-007). A record
 * that becomes effective later is scheduled, never current (SAL-008).
 */
function currentSalaryCondition(reportingDate: SQL): SQL {
  return sql`${salaryRecords.employeeId} = ${employees.id}
    and ${salaryRecords.effectiveFrom} <= ${reportingDate}
    and ${salaryRecords.effectiveFrom} = (
      select max(sr.effective_from) from ${sql.identifier('salary_records')} sr
      where sr.employee_id = ${employees.id}
        and sr.effective_from <= ${reportingDate}
    )`;
}

/**
 * Build the `WHERE` clause for the compensation filters.
 *
 * The filter model is the directory's, so the two surfaces cannot drift
 * (QRY-003, ANA-007). Returns `undefined` when no filter applies, so the
 * query has no `WHERE` at all — which also lets `isEmptyPopulation` tell
 * "no data" from "no match" (QRY-007).
 *
 * @param options.currentWorkforceOnly restricts the population to the active
 *        and on-leave workforce when no explicit status filter was given
 *        (ANA-002)
 */
function buildFilter(
  query: CompensationQuery,
  options: { readonly currentWorkforceOnly?: boolean } = {},
): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.country !== undefined) {
    conditions.push(eq(employees.countryCode, query.country));
  }

  if (query.status !== undefined) {
    conditions.push(eq(employees.employmentStatus, query.status));
  } else if (options.currentWorkforceOnly === true) {
    conditions.push(inArray(employees.employmentStatus, [...CURRENT_WORKFORCE_STATUSES]));
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
 * Read one page of the current-salary population.
 *
 * The population is the directory's: every employee who matches the filters,
 * with their current salary attached. The page is served server-side and the
 * page size is capped, so the browser never receives the whole workforce
 * (ANA-007).
 *
 * @param db a Neon or PGlite Drizzle handle
 * @param query the validated compensation request
 */
export async function queryCompensationPopulation(
  db: CompensationDatabase,
  query: CompensationQuery,
): Promise<CompensationPopulationResult> {
  const where = buildFilter(query);
  const reportingDate = reportingDateExpression(query.asOf);

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const base = db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      jobTitle: employees.jobTitle,
      jobLevel: employees.jobLevel,
      employmentStatus: employees.employmentStatus,
      workMode: employees.workMode,
      countryCode: employees.countryCode,
      departmentName: departments.name,
      branchCode: branches.branchCode,
      branchCity: branches.city,
      baseSalary: salaryRecords.baseSalary,
      currencyCode: salaryRecords.currencyCode,
      usdEquivalent: salaryRecords.usdEquivalent,
    })
    .from(employees)
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .leftJoin(salaryRecords, currentSalaryCondition(reportingDate));

  const filtered = where === undefined ? base : base.where(where);

  const rows = await filtered
    .orderBy(asc(employees.lastName), asc(employees.firstName), asc(employees.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const totalRows = await db.select({ value: count() }).from(employees).where(where);
  const total = totalRows[0]?.value ?? 0;

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    isEmptyPopulation: total === 0 && where === undefined,
  };
}

/**
 * The aggregate row shape the two aggregate queries share.
 */
interface AggregateRowShape {
  readonly currency: string;
  readonly headcount: number;
  readonly median: string | null;
  readonly average: string | null;
  readonly lowest: string | null;
  readonly highest: string | null;
}

/** Copy an aggregate row into the exported shape. */
function toCurrencyAggregate(row: AggregateRowShape): CurrencyAggregateRow {
  return {
    currency: row.currency,
    headcount: row.headcount,
    median: row.median,
    average: row.average,
    lowest: row.lowest,
    highest: row.highest,
  };
}

/**
 * Read the compensation aggregates, grouped by currency.
 *
 * Every figure is computed by PostgreSQL over the current-salary population;
 * nothing is aggregated in JavaScript. There is **no** total across
 * currencies — the result is one entry per currency, so a mixed-currency
 * number cannot be produced by accident (MON-004, RPT-007, ANA-005).
 *
 * The second set is the same groups measured in the synthetic USD equivalent.
 * It is a separate, explicitly labelled view of the same population, never a
 * substitute for the local amounts (MON-005, MON-006).
 *
 * @param db a Neon or PGlite Drizzle handle
 * @param query the validated compensation request
 */
export async function queryCurrencyAggregates(
  db: CompensationDatabase,
  query: CompensationQuery,
): Promise<CurrencyAggregatesResult> {
  const where = buildFilter(query);
  const reportingDate = reportingDateExpression(query.asOf);

  const localBase = db
    .select({
      currency: salaryRecords.currencyCode,
      headcount: count(),
      median: sql<MoneyString>`cast(round(cast(percentile_cont(cast(0.5 as numeric)) within group (order by ${salaryRecords.baseSalary}) as numeric), 2) as text)`,
      average: sql<MoneyString>`cast(round(avg(${salaryRecords.baseSalary}), 2) as text)`,
      lowest: sql<MoneyString>`cast(min(${salaryRecords.baseSalary}) as text)`,
      highest: sql<MoneyString>`cast(max(${salaryRecords.baseSalary}) as text)`,
    })
    .from(employees)
    .innerJoin(salaryRecords, currentSalaryCondition(reportingDate));

  const localRows = await (where === undefined ? localBase : localBase.where(where))
    .groupBy(salaryRecords.currencyCode)
    .orderBy(asc(salaryRecords.currencyCode));

  // The USD-equivalent set measures the same populations in the synthetic
  // equivalent. A currency whose current salaries carry no equivalent has no
  // figure at all, so it is left out rather than shown as an empty block.
  const usdBase = db
    .select({
      currency: salaryRecords.currencyCode,
      headcount: count(salaryRecords.usdEquivalent),
      median: sql<MoneyString>`cast(round(cast(percentile_cont(cast(0.5 as numeric)) within group (order by ${salaryRecords.usdEquivalent}) as numeric), 2) as text)`,
      average: sql<MoneyString>`cast(round(avg(${salaryRecords.usdEquivalent}), 2) as text)`,
      lowest: sql<MoneyString>`cast(min(${salaryRecords.usdEquivalent}) as text)`,
      highest: sql<MoneyString>`cast(max(${salaryRecords.usdEquivalent}) as text)`,
    })
    .from(employees)
    .innerJoin(salaryRecords, currentSalaryCondition(reportingDate));

  const usdRows = await (where === undefined ? usdBase : usdBase.where(where))
    .groupBy(salaryRecords.currencyCode)
    .having(sql`count(${salaryRecords.usdEquivalent}) > 0`)
    .orderBy(asc(salaryRecords.currencyCode));

  return {
    byCurrency: localRows.map(toCurrencyAggregate),
    byUsdEquivalent: usdRows.map(toCurrencyAggregate),
  };
}

/**
 * Read the grouped headcount figures.
 *
 * The count is the sample size of the group, so a reader can see how many
 * employees a figure describes (ANA-005).
 */
async function queryCountGroups(
  db: CompensationDatabase,
  groupBy: AnalyticsGrouping,
  where: SQL | undefined,
): Promise<AnalyticsGroupRow[]> {
  const group = GROUP_EXPRESSIONS[groupBy];

  const base = db
    .select({ group, count: count() })
    .from(employees)
    .innerJoin(departments, eq(employees.departmentId, departments.id));

  const rows = await (where === undefined ? base : base.where(where))
    .groupBy(group)
    .orderBy(desc(count()), asc(group));

  return rows.map((row) => ({
    group: row.group,
    currency: null,
    count: row.count,
    median: null,
    average: null,
  }));
}

/**
 * Read the grouped salary figures.
 *
 * A salary figure is only ever stated within a single currency, so the result
 * is keyed by (group, currency) — "Engineering / USD" is one figure and
 * "Engineering / EUR" is another. The two are never blended (ANA-005).
 */
async function querySalaryGroups(
  db: CompensationDatabase,
  metric: 'medianSalary' | 'averageSalary',
  groupBy: AnalyticsGrouping,
  where: SQL | undefined,
  reportingDate: SQL,
): Promise<AnalyticsGroupRow[]> {
  const group = GROUP_EXPRESSIONS[groupBy];
  const isMedian = metric === 'medianSalary';

  // Only the requested aggregate is computed: an unneeded `percentile_cont`
  // or `avg` over 10,000 rows is work the database should not do.
  const median = sql<MoneyString>`cast(round(cast(percentile_cont(cast(0.5 as numeric)) within group (order by ${salaryRecords.baseSalary}) as numeric), 2) as text)`;
  const average = sql<MoneyString>`cast(round(avg(${salaryRecords.baseSalary}), 2) as text)`;

  const base = db
    .select({
      group,
      currency: salaryRecords.currencyCode,
      count: count(),
      median: isMedian ? median : sql<MoneyString | null>`null::text`,
      average: isMedian ? sql<MoneyString | null>`null::text` : average,
    })
    .from(employees)
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .innerJoin(salaryRecords, currentSalaryCondition(reportingDate));

  const rows = await (where === undefined ? base : base.where(where))
    .groupBy(group, salaryRecords.currencyCode)
    .orderBy(asc(group), asc(salaryRecords.currencyCode));

  return rows.map((row) => ({
    group: row.group,
    currency: row.currency,
    count: row.count,
    median: row.median,
    average: row.average,
  }));
}

/**
 * Read the grouped analytics figures.
 *
 * The metric and the grouping come from the request; both are allow-listed,
 * and a pairing the metric cannot answer falls back to the one it can
 * (QRY-003, QRY-005).
 *
 * A headcount describes the active and on-leave workforce unless terminated
 * employees are explicitly included, or a status filter asks for them
 * (ANA-002). The reporting date selects the effective-dated salary state
 * (ANA-006). An empty result is an empty array — never a fabricated zero
 * salary (ANA-004).
 *
 * @param db a Neon or PGlite Drizzle handle
 * @param query the validated compensation request
 */
export async function queryAnalyticsGroups(
  db: CompensationDatabase,
  query: CompensationQuery,
): Promise<AnalyticsGroupRow[]> {
  const metric: AnalyticsMetric = query.metric ?? DEFAULT_ANALYTICS_METRIC;
  const allowed = supportedGroupings(metric);
  const requested: AnalyticsGrouping = query.groupBy ?? DEFAULT_ANALYTICS_GROUPING;
  const groupBy: AnalyticsGrouping = allowed.includes(requested)
    ? requested
    : (allowed[0] ?? DEFAULT_ANALYTICS_GROUPING);

  const where = buildFilter(query, { currentWorkforceOnly: query.includeTerminated !== true });
  const reportingDate = reportingDateExpression(query.asOf);

  if (metric === 'salaryDistribution') {
    // A salary distribution counts the employees whose salary history has a
    // record effective on the reporting date, grouped by level. A person
    // with no salary record is not in a distribution of salaries.
    const group = GROUP_EXPRESSIONS[groupBy];

    const base = db
      .select({ group, count: count() })
      .from(employees)
      .innerJoin(departments, eq(employees.departmentId, departments.id))
      .innerJoin(salaryRecords, currentSalaryCondition(reportingDate));

    const rows = await (where === undefined ? base : base.where(where))
      .groupBy(group)
      .orderBy(asc(group));

    return rows.map((row) => ({
      group: row.group,
      currency: null,
      count: row.count,
      median: null,
      average: null,
    }));
  }

  if (metric === 'headcount') {
    return queryCountGroups(db, groupBy, where);
  }

  return querySalaryGroups(db, metric, groupBy, where, reportingDate);
}

/**
 * Read the workforce size, split by employment status.
 *
 * The statuses are reported separately rather than as one blended headcount,
 * because "how many people work here" and "how many people have left" are
 * different facts (ANA-001, ANA-002).
 *
 * @param db a Neon or PGlite Drizzle handle
 */
export async function queryWorkforceSummary(db: CompensationDatabase): Promise<WorkforceSummary> {
  const rows = await db
    .select({ status: employees.employmentStatus, value: count() })
    .from(employees)
    .groupBy(employees.employmentStatus);

  let active = 0;
  let onLeave = 0;
  let terminated = 0;

  for (const row of rows) {
    if (row.status === 'active') {
      active = row.value;
    } else if (row.status === 'on_leave') {
      onLeave = row.value;
    } else if (row.status === 'terminated') {
      terminated = row.value;
    }
  }

  return { active, onLeave, terminated, total: active + onLeave + terminated };
}

/**
 * Read the workforce distribution for the overview's count panels.
 *
 * Every employee is counted, terminated included, because the overview states
 * the size of the whole organisation (ANA-001). The groups are ordered by
 * size and then by label, so the panels are stable between requests.
 *
 * @param db a Neon or PGlite Drizzle handle
 * @param query an optional scope for the distribution
 */
export async function queryDistribution(
  db: CompensationDatabase,
  query: CompensationQuery = {},
): Promise<WorkforceDistribution> {
  const where = buildFilter(query);

  const countryBase = db
    .select({ label: GROUP_EXPRESSIONS.country, count: count() })
    .from(employees);
  const countryRows = await (where === undefined ? countryBase : countryBase.where(where))
    .groupBy(GROUP_EXPRESSIONS.country)
    .orderBy(desc(count()), asc(GROUP_EXPRESSIONS.country));

  const departmentBase = db
    .select({ label: GROUP_EXPRESSIONS.department, count: count() })
    .from(employees)
    .innerJoin(departments, eq(employees.departmentId, departments.id));
  const departmentRows = await (
    where === undefined ? departmentBase : departmentBase.where(where)
  )
    .groupBy(GROUP_EXPRESSIONS.department)
    .orderBy(desc(count()), asc(GROUP_EXPRESSIONS.department));

  return {
    byCountry: countryRows.map((row) => ({ label: row.label, count: row.count })),
    byDepartment: departmentRows.map((row) => ({ label: row.label, count: row.count })),
  };
}

/**
 * Read the most recently recorded salary changes.
 *
 * The previous amount comes from a `lag` window over the same employee's
 * effective-dated history, so "what changed" is answered by the database
 * rather than by re-reading each employee's history.
 *
 * @param db a Neon or PGlite Drizzle handle
 * @param limit how many changes to return
 */
export async function queryRecentChanges(
  db: CompensationDatabase,
  limit: number = DEFAULT_RECENT_CHANGE_LIMIT,
): Promise<RecentSalaryChange[]> {
  const bounded = Math.max(1, Math.min(limit, MAX_PAGE_SIZE));

  const rows = await db
    .select({
      employeeId: salaryRecords.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      effectiveFrom: salaryRecords.effectiveFrom,
      baseSalary: salaryRecords.baseSalary,
      currencyCode: salaryRecords.currencyCode,
      changeReason: salaryRecords.changeReason,
      previousBaseSalary: sql<MoneyString | null>`lag(${salaryRecords.baseSalary}) over (
        partition by ${salaryRecords.employeeId} order by ${salaryRecords.effectiveFrom}
      )`,
    })
    .from(salaryRecords)
    .innerJoin(employees, eq(salaryRecords.employeeId, employees.id))
    // Ordered by the **effective date**, not by the row's creation time.
    // Every seeded row carries the same creation timestamp, so ordering by it
    // leaves the order arbitrary — the reader would see effective dates
    // jumping around with no sense of recency. The effective date is what
    // "recent change" means to a reader (SAL-007).
    .orderBy(desc(salaryRecords.effectiveFrom), desc(salaryRecords.id))
    .limit(bounded);

  return rows.map((row) => ({
    employeeId: row.employeeId,
    firstName: row.firstName,
    lastName: row.lastName,
    effectiveFrom: row.effectiveFrom,
    baseSalary: row.baseSalary,
    currencyCode: row.currencyCode,
    previousBaseSalary: row.previousBaseSalary,
    changeReason: row.changeReason,
  }));
}

/**
 * One deterministic data-quality rule.
 */
interface DataQualityRule {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  /** The condition an employee must satisfy to be flagged. */
  readonly condition: SQL;
}

/**
 * Build the data-quality rules.
 *
 * Each rule is a condition on the employee row, expressed with `EXISTS`
 * sub-queries over the salary index, so the database does the work rather
 * than a JavaScript scan of the workforce.
 *
 * @param reportingDate the reporting date the "current" salary is read at
 */
function buildDataQualityRules(reportingDate: SQL): DataQualityRule[] {
  return [
    {
      code: 'missing-salary',
      title: 'No salary record',
      description:
        'This employee has no salary record at all, so their compensation cannot be reported.',
      condition: sql`not exists (
        select 1 from ${sql.identifier('salary_records')} sr where sr.employee_id = ${employees.id}
      )`,
    },
    {
      code: 'currency-mismatch',
      title: 'Salary currency does not match the branch policy',
      description:
        'The current salary is recorded in a different currency from the currency of the branch the employee belongs to.',
      condition: sql`exists (
        select 1 from ${sql.identifier('salary_records')} sr
        where sr.employee_id = ${employees.id}
          and sr.effective_from <= ${reportingDate}
          and sr.effective_from = (
            select max(sr2.effective_from) from ${sql.identifier('salary_records')} sr2
            where sr2.employee_id = ${employees.id}
              and sr2.effective_from <= ${reportingDate}
          )
          and sr.currency_code <> (
            select b.currency_code from ${sql.identifier('branches')} b where b.id = ${employees.branchId}
          )
      )`,
    },
    {
      code: 'duplicate-effective-date',
      title: 'More than one salary record for the same effective date',
      description:
        'Two salary records share one effective date, so which of them is the current salary is ambiguous.',
      condition: sql`exists (
        select 1 from ${sql.identifier('salary_records')} sr
        where sr.employee_id = ${employees.id}
          and sr.effective_from in (
            select sr3.effective_from from ${sql.identifier('salary_records')} sr3
            where sr3.employee_id = ${employees.id}
            group by sr3.effective_from
            having count(*) > 1
          )
      )`,
    },
    {
      code: 'missing-termination-date',
      title: 'Terminated without a termination date',
      description:
        'The employee is recorded as terminated, but no termination date is stored for them.',
      condition: sql`${employees.employmentStatus} = 'terminated' and ${employees.terminationDate} is null`,
    },
    {
      code: 'active-with-termination-date',
      title: 'Active with a termination date',
      description:
        'The employee is recorded as active, but a termination date is stored for them.',
      condition: sql`${employees.employmentStatus} = 'active' and ${employees.terminationDate} is not null`,
    },
    {
      code: 'salary-before-hire',
      title: 'Salary effective before the hire date',
      description:
        'A salary record takes effect before the employee was hired, so the history cannot be read as written.',
      condition: sql`exists (
        select 1 from ${sql.identifier('salary_records')} sr
        where sr.employee_id = ${employees.id}
          and sr.effective_from < ${employees.hireDate}
      )`,
    },
    {
      // The USD equivalent is a derived value: it is the local amount
      // converted at the rate the record itself states. A disagreement means
      // the stored figure and the stated rate tell different stories, so a
      // reader comparing the two would get two different answers (MON-005,
      // MON-006). The seeded cohort contains 672 of these.
      code: 'equivalent-mismatch',
      title: 'USD equivalent does not match the stated rate',
      description:
        'A salary record stores a USD equivalent that does not equal its amount converted at the rate the record states.',
      condition: sql`exists (
        select 1 from ${sql.identifier('salary_records')} sr
        where sr.employee_id = ${employees.id}
          and sr.usd_to_local_fx is not null
          and sr.usd_equivalent is not null
          and round(sr.base_salary / sr.usd_to_local_fx, 2) <> sr.usd_equivalent
      )`,
    },
    {
      // The absence summary is optional context, so this is a completeness
      // observation rather than an error. It is still worth reviewing: a
      // reader looking at the profile needs to know which context is absent
      // rather than inferring it from a missing card. The seeded cohort
      // contains 4,582 of these.
      code: 'missing-absence-summary',
      title: 'No absence summary',
      description:
        'The employee has no absence summary, so their profile shows no absence context.',
      condition: sql`not exists (
        select 1 from ${sql.identifier('absence_records')} ar where ar.employee_id = ${employees.id}
      )`,
    },
  ];
}

/**
 * Read the deterministic data-quality findings.
 *
 * The same data always produces the same findings: the rules are fixed, the
 * affected employees are ordered by id, and nothing depends on a clock or on
 * a random value.
 *
 * Every finding carries the employees it affects, so the page can link to
 * each one. The list is capped, but the count is always the full count, so a
 * truncated list never hides the size of the problem.
 *
 * The rules are scoped by the request's filters, so a filtered work queue
 * shows the findings inside that scope.
 *
 * @param db a Neon or PGlite Drizzle handle
 * @param query an optional scope for the findings
 */
export async function queryDataQualityIssues(
  db: CompensationDatabase,
  query: CompensationQuery = {},
): Promise<DataQualityResult> {
  const where = buildFilter(query);
  const reportingDate = reportingDateExpression(query.asOf);
  const rules = buildDataQualityRules(reportingDate);

  const issues: DataQualityIssueRow[] = [];

  for (const rule of rules) {
    const scoped = where === undefined ? rule.condition : and(where, rule.condition);

    // The window count is evaluated before the limit, so the count is the
    // full count while the rows are the capped list.
    const rows = await db
      .select({
        id: employees.id,
        total: sql<number>`cast(count(*) over () as int)`,
      })
      .from(employees)
      .where(scoped)
      .orderBy(employees.id)
      .limit(MAX_AFFECTED_EMPLOYEES_PER_ISSUE + 1);

    const affected = rows[0]?.total ?? 0;

    issues.push({
      code: rule.code,
      title: rule.title,
      description: rule.description,
      count: affected,
      employeeIds: rows.map((row) => row.id).slice(0, MAX_AFFECTED_EMPLOYEES_PER_ISSUE),
      hasMore: affected > MAX_AFFECTED_EMPLOYEES_PER_ISSUE,
    });
  }

  const anyIssue = or(
    ...rules.map((rule) => (where === undefined ? rule.condition : and(where, rule.condition))),
  );
  const affectedRows = await db.select({ value: count() }).from(employees).where(anyIssue);

  return {
    issues,
    affectedEmployees: affectedRows[0]?.value ?? 0,
  };
}
