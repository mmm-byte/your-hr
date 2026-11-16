/**
 * Covers:
 * - ANA-001 the workforce summary states its scope and splits by status
 * - ANA-002 a headcount describes the current workforce unless terminated employees are included
 * - ANA-003 the median is the mean of the two middle values for an even-length set
 * - ANA-004 an empty selection is an empty array, never a fabricated zero
 * - ANA-005 a salary figure is stated within one currency
 * - ANA-006 the aggregates read the current, effective-dated salary
 * - ANA-007 the population is filtered and paged on the server
 * - MON-002 money stays an exact decimal string; MON-004 no figure crosses currencies
 * - QRY-007 "no data" is distinguished from "no rows match"
 * - SAL-007 the current salary is the latest record effective on or before the reporting date
 * - SAL-008 a future-effective record is scheduled, never current
 * - The data-quality rules: missing-salary, currency-mismatch, equivalent-mismatch,
 *   and missing-absence-summary
 *
 * Does not cover:
 * - The duplicate-effective-date, missing-termination-date, and active-with-termination-date
 *   rules: the schema's unique index and CHECK constraints forbid the states they look for
 * - The salary-before-hire rule: every fixture here keeps its effective date on or after
 *   the hire date
 * - The pure median/average helpers (tests/unit/analytics.test.ts)
 * - The Phase 5 UI (tests/component/)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { getTestDatabase, resetTestDatabase } from '../setup/integration';
import {
  queryAnalyticsGroups,
  queryCompensationPopulation,
  queryCurrencyAggregates,
  queryDataQualityIssues,
  queryRecentChanges,
  queryWorkforceSummary,
  type CompensationDatabase,
} from '@/db/queries/compensation';
import { schema } from '@/db/schema';

let pglite: PGlite;
let db: CompensationDatabase;

/**
 * The reporting date every query reads at.
 *
 * It is a pinned calendar day, never "today", so the tests cannot move with
 * the wall clock (RPT-001, RPT-004).
 */
const REPORTING_DATE = '2026-01-01';

/** The moment a seeded salary row is treated as having been written. */
const DEFAULT_SALARY_CREATED_AT = '2026-01-01 00:00:00+00';

/**
 * The employee rows a test needs.
 *
 * Every field carries a default, so a test states only what it is asserting
 * on and the seeded row stays visible at the call site.
 */
interface EmployeeSeed {
  readonly id: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly departmentId?: number;
  readonly branchId?: number;
  readonly countryCode?: string;
  readonly jobTitle?: string;
  readonly jobLevel?: number;
  readonly employmentStatus?: 'active' | 'on_leave' | 'terminated';
  readonly workMode?: 'remote' | 'hybrid' | 'office';
  readonly hireDate?: string;
  readonly terminationDate?: string | null;
}

/**
 * Insert one employee.
 *
 * The email is derived from the id so the unique index can never be the
 * reason a fixture fails for an unexpected reason.
 */
async function seedEmployee(employee: EmployeeSeed): Promise<void> {
  await pglite.query(
    `insert into employees
       (id, first_name, last_name, email, department_id, job_title, job_level, branch_id,
        country_code, hire_date, termination_date, employment_status, gender, date_of_birth, work_mode)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Female', '1990-05-04', $13)`,
    [
      employee.id,
      employee.firstName,
      employee.lastName,
      `employee.${employee.id}@corp.example.com`,
      employee.departmentId ?? 1,
      employee.jobTitle ?? 'Analyst',
      employee.jobLevel ?? 4,
      employee.branchId ?? 1,
      employee.countryCode ?? 'US',
      employee.hireDate ?? '2020-01-01',
      employee.terminationDate ?? null,
      employee.employmentStatus ?? 'active',
      employee.workMode ?? 'hybrid',
    ],
  );
}

/**
 * Insert one salary record.
 *
 * `createdAt` is written explicitly so the order of the recent-changes list
 * never depends on when the test happened to run.
 */
async function seedSalary(
  employeeId: number,
  effectiveFrom: string,
  baseSalary: string,
  currencyCode: string,
  options: {
    readonly usdEquivalent?: string | null;
    readonly usdToLocalFx?: string | null;
    readonly createdAt?: string;
  } = {},
): Promise<void> {
  await pglite.query(
    `insert into salary_records
       (employee_id, effective_from, base_salary, bonus_pct, currency_code,
        usd_equivalent, usd_to_local_fx, created_at)
     values ($1, $2, $3, '0.00', $4, $5, $6, $7)`,
    [
      employeeId,
      effectiveFrom,
      baseSalary,
      currencyCode,
      options.usdEquivalent ?? null,
      options.usdToLocalFx ?? null,
      options.createdAt ?? DEFAULT_SALARY_CREATED_AT,
    ],
  );
}

/** Insert the absence summary one employee already has. */
async function seedAbsenceSummary(employeeId: number): Promise<void> {
  await pglite.query(
    `insert into absence_records (employee_id, record_count, total_days)
     values ($1, 2, 5)`,
    [employeeId],
  );
}

/**
 * The reference data every seeded employee points at.
 *
 * Branch 1 pays in USD, branch 2 in EUR, and branch 3 in INR — so a salary
 * can be stated in a different currency from its branch on purpose.
 */
async function seedReferenceData(): Promise<void> {
  await pglite.query(`insert into departments (id, name) values (1, 'Payroll')`);
  await pglite.query(`insert into departments (id, name) values (2, 'Accounting')`);
  await pglite.query(`insert into departments (id, name) values (3, 'Legal')`);

  await pglite.query(
    `insert into branches (id, branch_code, name, city, country_code, currency_code)
     values (1, 'US-NYC', 'New York Branch', 'New York', 'US', 'USD')`,
  );
  await pglite.query(
    `insert into branches (id, branch_code, name, city, country_code, currency_code)
     values (2, 'DE-BER', 'Berlin Branch', 'Berlin', 'DE', 'EUR')`,
  );
  await pglite.query(
    `insert into branches (id, branch_code, name, city, country_code, currency_code)
     values (3, 'IN-BLR', 'Bengaluru Branch', 'Bengaluru', 'IN', 'INR')`,
  );
}

beforeEach(async () => {
  await resetTestDatabase();
  pglite = await getTestDatabase();
  db = drizzle(pglite, { casing: 'snake_case', schema }) as unknown as CompensationDatabase;
  await seedReferenceData();
});

describe('queryCurrencyAggregates (ANA-003, ANA-004, ANA-005, ANA-006, MON-002, MON-004)', () => {
  it('takes the mean of the two middle values for an even-length set (ANA-003)', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });
    await seedEmployee({ id: 2, firstName: 'Ben', lastName: 'Baker' });
    await seedEmployee({ id: 3, firstName: 'Cara', lastName: 'Carter' });
    await seedEmployee({ id: 4, firstName: 'Dan', lastName: 'Dunn' });

    await seedSalary(1, '2024-01-01', '100.00', 'USD');
    await seedSalary(2, '2024-01-01', '200.00', 'USD');
    await seedSalary(3, '2024-01-01', '300.00', 'USD');
    await seedSalary(4, '2024-01-01', '400.00', 'USD');

    const result = await queryCurrencyAggregates(db, { asOf: REPORTING_DATE });

    expect(result.byCurrency).toHaveLength(1);
    expect(result.byCurrency[0]?.currency).toBe('USD');
    expect(result.byCurrency[0]?.headcount).toBe(4);
    expect(result.byCurrency[0]?.median).toBe('250.00');
  });

  it('takes the middle value for an odd-length set (ANA-003)', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });
    await seedEmployee({ id: 2, firstName: 'Ben', lastName: 'Baker' });
    await seedEmployee({ id: 3, firstName: 'Cara', lastName: 'Carter' });

    await seedSalary(1, '2024-01-01', '100.00', 'USD');
    await seedSalary(2, '2024-01-01', '200.00', 'USD');
    await seedSalary(3, '2024-01-01', '300.00', 'USD');

    const result = await queryCurrencyAggregates(db, { asOf: REPORTING_DATE });

    expect(result.byCurrency[0]?.headcount).toBe(3);
    expect(result.byCurrency[0]?.median).toBe('200.00');
  });

  it('states a median with exactly two decimals and no float noise (MON-002)', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });
    await seedEmployee({ id: 2, firstName: 'Ben', lastName: 'Baker' });

    // The mean of these two is 72466.815 — the value that would surface as
    // 72466.81500000001 if it were computed in binary floating point.
    await seedSalary(1, '2024-01-01', '72466.81', 'USD');
    await seedSalary(2, '2024-01-01', '72466.82', 'USD');

    const result = await queryCurrencyAggregates(db, { asOf: REPORTING_DATE });
    const median = result.byCurrency[0]?.median;

    expect(median).toBe('72466.82');
    expect(median).toMatch(/^\d+\.\d{2}$/);
  });

  it('states no total across currencies (ANA-005, MON-004)', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott', branchId: 1 });
    await seedEmployee({ id: 2, firstName: 'Ben', lastName: 'Baker', branchId: 1 });
    await seedEmployee({
      id: 3,
      firstName: 'Cara',
      lastName: 'Carter',
      branchId: 2,
      countryCode: 'DE',
    });
    await seedEmployee({
      id: 4,
      firstName: 'Dan',
      lastName: 'Dunn',
      branchId: 2,
      countryCode: 'DE',
    });

    await seedSalary(1, '2024-01-01', '100.00', 'USD');
    await seedSalary(2, '2024-01-01', '200.00', 'USD');
    await seedSalary(3, '2024-01-01', '300.00', 'EUR');
    await seedSalary(4, '2024-01-01', '400.00', 'EUR');

    const result = await queryCurrencyAggregates(db, { asOf: REPORTING_DATE });

    expect(result.byCurrency).toHaveLength(2);
    expect(result.byCurrency.map((row) => row.currency).sort()).toEqual(['EUR', 'USD']);
    expect(new Set(result.byCurrency.map((row) => row.currency)).size).toBe(2);
    expect(result.byCurrency.every((row) => row.currency === 'USD' || row.currency === 'EUR')).toBe(
      true,
    );
  });

  it('returns an empty array for a population with no salary rows (ANA-004)', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });
    await seedEmployee({ id: 2, firstName: 'Ben', lastName: 'Baker' });

    const result = await queryCurrencyAggregates(db, { asOf: REPORTING_DATE });

    expect(result.byCurrency).toEqual([]);
    expect(result.byCurrency.some((row) => row.median === '0.00')).toBe(false);
  });

  it('describes the current salary, not the history (ANA-006, SAL-007)', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });

    await seedSalary(1, '2024-01-01', '50000.00', 'USD');
    await seedSalary(1, '2025-06-01', '60000.00', 'USD');

    const result = await queryCurrencyAggregates(db, { asOf: REPORTING_DATE });

    expect(result.byCurrency).toHaveLength(1);
    expect(result.byCurrency[0]?.headcount).toBe(1);
    expect(result.byCurrency[0]?.median).toBe('60000.00');
  });
});

describe('queryCompensationPopulation (ANA-007, QRY-007, SAL-007, SAL-008)', () => {
  /** The 30 employees the pagination test pages through. */
  const PAGED_EMPLOYEES: readonly [firstName: string, lastName: string][] = [
    ['Ada', 'Alvarez'],
    ['Ben', 'Brooks'],
    ['Cara', 'Carter'],
    ['Dan', 'Dunn'],
    ['Eli', 'Evans'],
    ['Fay', 'Foster'],
    ['Gus', 'Green'],
    ['Hana', 'Hall'],
    ['Iris', 'Ingram'],
    ['Jack', 'Jones'],
    ['Kim', 'Khan'],
    ['Leo', 'Lewis'],
    ['Mia', 'Martin'],
    ['Noah', 'Nash'],
    ['Olive', 'Owen'],
    ['Paul', 'Price'],
    ['Quinn', 'Quick'],
    ['Rosa', 'Reed'],
    ['Sam', 'Shah'],
    ['Tara', 'Turner'],
    ['Uma', 'Uppal'],
    ['Vic', 'Vega'],
    ['Wanda', 'Wells'],
    ['Xena', 'Xu'],
    ['Yuri', 'Young'],
    ['Zara', 'Zhang'],
    ['Abe', 'Brown'],
    ['Bea', 'Blake'],
    ['Cleo', 'Cole'],
    ['Dev', 'Diaz'],
  ];

  it('returns one bounded page and the real total (ANA-007)', async () => {
    for (const [index, [firstName, lastName]] of PAGED_EMPLOYEES.entries()) {
      await seedEmployee({ id: 101 + index, firstName, lastName });
    }

    const result = await queryCompensationPopulation(db, {
      asOf: REPORTING_DATE,
      pageSize: 25,
    });

    expect(result.rows).toHaveLength(25);
    expect(result.total).toBe(30);
    expect(result.totalPages).toBe(2);
  });

  it('does not make a future-effective record current (SAL-008)', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });
    await seedEmployee({ id: 2, firstName: 'Ben', lastName: 'Baker' });

    await seedSalary(1, '2024-01-01', '50000.00', 'USD');
    await seedSalary(1, '2027-03-01', '80000.00', 'USD');
    await seedSalary(2, '2030-01-01', '90000.00', 'USD');

    const result = await queryCompensationPopulation(db, { asOf: REPORTING_DATE });

    const withCurrentSalary = result.rows.find((row) => row.id === 1);
    const withOnlyAScheduledSalary = result.rows.find((row) => row.id === 2);

    expect(withCurrentSalary?.baseSalary).toBe('50000.00');
    expect(withOnlyAScheduledSalary?.baseSalary).toBeNull();
  });

  it('distinguishes no data from no rows matching the filters (QRY-007)', async () => {
    const empty = await queryCompensationPopulation(db, { asOf: REPORTING_DATE });
    expect(empty.total).toBe(0);
    expect(empty.isEmptyPopulation).toBe(true);

    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });

    const noMatch = await queryCompensationPopulation(db, {
      asOf: REPORTING_DATE,
      status: 'terminated',
    });
    expect(noMatch.total).toBe(0);
    expect(noMatch.isEmptyPopulation).toBe(false);
  });
});

describe('queryAnalyticsGroups (ANA-002, ANA-003, ANA-004, ANA-005)', () => {
  it('counts the current workforce by default (ANA-002)', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott', employmentStatus: 'active' });
    await seedEmployee({
      id: 2,
      firstName: 'Ben',
      lastName: 'Baker',
      employmentStatus: 'on_leave',
    });
    await seedEmployee({
      id: 3,
      firstName: 'Cara',
      lastName: 'Carter',
      employmentStatus: 'terminated',
      terminationDate: '2025-12-31',
    });

    const result = await queryAnalyticsGroups(db, {
      metric: 'headcount',
      groupBy: 'status',
      asOf: REPORTING_DATE,
    });

    expect(result.map((row) => row.group)).toEqual(['active', 'on_leave']);
    expect(result.reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });

  it('counts terminated employees when they are explicitly included (ANA-002)', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott', employmentStatus: 'active' });
    await seedEmployee({
      id: 2,
      firstName: 'Ben',
      lastName: 'Baker',
      employmentStatus: 'on_leave',
    });
    await seedEmployee({
      id: 3,
      firstName: 'Cara',
      lastName: 'Carter',
      employmentStatus: 'terminated',
      terminationDate: '2025-12-31',
    });

    const result = await queryAnalyticsGroups(db, {
      metric: 'headcount',
      groupBy: 'status',
      includeTerminated: true,
      asOf: REPORTING_DATE,
    });

    expect(result.map((row) => row.group)).toEqual(['active', 'on_leave', 'terminated']);
    expect(result.reduce((sum, row) => sum + row.count, 0)).toBe(3);
  });

  it('states a salary figure within one currency (ANA-005)', async () => {
    await seedEmployee({
      id: 1,
      firstName: 'Ann',
      lastName: 'Abbott',
      departmentId: 2,
      branchId: 1,
    });
    await seedEmployee({
      id: 2,
      firstName: 'Ben',
      lastName: 'Baker',
      departmentId: 2,
      branchId: 2,
      countryCode: 'DE',
    });

    await seedSalary(1, '2024-01-01', '100000.00', 'USD');
    await seedSalary(2, '2024-01-01', '80000.00', 'EUR');

    const result = await queryAnalyticsGroups(db, {
      metric: 'medianSalary',
      groupBy: 'department',
      asOf: REPORTING_DATE,
    });

    expect(result).toHaveLength(2);
    expect(result.every((row) => row.group === 'Accounting')).toBe(true);
    expect(result.map((row) => row.currency).sort()).toEqual(['EUR', 'USD']);
    expect(result.every((row) => row.count === 1)).toBe(true);

    const eur = result.find((row) => row.currency === 'EUR');
    const usd = result.find((row) => row.currency === 'USD');
    expect(eur?.median).toBe('80000.00');
    expect(usd?.median).toBe('100000.00');
  });

  it('returns an empty array for an empty selection (ANA-004)', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });
    await seedEmployee({
      id: 2,
      firstName: 'Ben',
      lastName: 'Baker',
      branchId: 2,
      countryCode: 'DE',
    });
    await seedSalary(1, '2024-01-01', '100000.00', 'USD');
    await seedSalary(2, '2024-01-01', '80000.00', 'EUR');

    const headcount = await queryAnalyticsGroups(db, {
      metric: 'headcount',
      country: 'GB',
      asOf: REPORTING_DATE,
    });
    const median = await queryAnalyticsGroups(db, {
      metric: 'medianSalary',
      country: 'GB',
      asOf: REPORTING_DATE,
    });

    expect(headcount).toEqual([]);
    expect(median).toEqual([]);
    expect(median.some((row) => row.median === '0.00')).toBe(false);
  });
});

describe('queryDataQualityIssues (FEATURES.md)', () => {
  /** Find one rule's finding in the result. */
  function issueFor(
    result: Awaited<ReturnType<typeof queryDataQualityIssues>>,
    code: string,
  ) {
    const issue = result.issues.find((candidate) => candidate.code === code);
    if (issue === undefined) {
      throw new Error(`Expected a finding for "${code}".`);
    }
    return issue;
  }

  it('finds a stored USD equivalent that disagrees with the stated rate', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });
    await seedSalary(1, '2024-01-01', '1000.00', 'USD', {
      usdToLocalFx: '1.00000',
      usdEquivalent: '999.99',
    });

    const result = await queryDataQualityIssues(db, { asOf: REPORTING_DATE });
    const issue = issueFor(result, 'equivalent-mismatch');

    expect(issue.count).toBe(1);
    expect(issue.employeeIds).toContain(1);
  });

  it('finds an employee with no absence summary', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });
    await seedEmployee({ id: 2, firstName: 'Ben', lastName: 'Baker' });
    await seedAbsenceSummary(1);

    const result = await queryDataQualityIssues(db, { asOf: REPORTING_DATE });
    const issue = issueFor(result, 'missing-absence-summary');

    expect(issue.count).toBe(1);
    expect(issue.employeeIds).toEqual([2]);
  });

  it('finds an employee with no salary record', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });
    await seedEmployee({ id: 2, firstName: 'Ben', lastName: 'Baker' });
    await seedSalary(2, '2024-01-01', '50000.00', 'USD');

    const result = await queryDataQualityIssues(db, { asOf: REPORTING_DATE });
    const issue = issueFor(result, 'missing-salary');

    expect(issue.count).toBe(1);
    expect(issue.employeeIds).toEqual([1]);
  });

  it('finds a salary recorded in a currency other than the branch policy', async () => {
    await seedEmployee({
      id: 1,
      firstName: 'Ann',
      lastName: 'Abbott',
      branchId: 1,
      countryCode: 'US',
    });
    // The branch pays in USD; the salary is recorded in EUR.
    await seedSalary(1, '2024-01-01', '1000.00', 'EUR');

    const result = await queryDataQualityIssues(db, { asOf: REPORTING_DATE });
    const issue = issueFor(result, 'currency-mismatch');

    expect(issue.count).toBe(1);
    expect(issue.employeeIds).toEqual([1]);
  });

  it('finds nothing in a clean population', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });
    await seedEmployee({
      id: 2,
      firstName: 'Ben',
      lastName: 'Baker',
      branchId: 2,
      countryCode: 'DE',
    });

    await seedSalary(1, '2024-01-01', '1000.00', 'USD', {
      usdToLocalFx: '1.00000',
      usdEquivalent: '1000.00',
    });
    await seedSalary(2, '2024-01-01', '2000.00', 'EUR', {
      usdToLocalFx: '2.00000',
      usdEquivalent: '1000.00',
    });

    await seedAbsenceSummary(1);
    await seedAbsenceSummary(2);

    const result = await queryDataQualityIssues(db, { asOf: REPORTING_DATE });

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((issue) => issue.count === 0)).toBe(true);
    expect(result.affectedEmployees).toBe(0);
  });

  it('returns the same findings in the same order every time', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });
    await seedEmployee({ id: 2, firstName: 'Ben', lastName: 'Baker' });
    await seedSalary(1, '2024-01-01', '1000.00', 'USD', {
      usdToLocalFx: '1.00000',
      usdEquivalent: '999.99',
    });
    await seedSalary(2, '2024-01-01', '2000.00', 'USD');
    await seedAbsenceSummary(1);

    const first = await queryDataQualityIssues(db, { asOf: REPORTING_DATE });
    const second = await queryDataQualityIssues(db, { asOf: REPORTING_DATE });

    // The catalogue of rules is the contract; the order they are declared in
    // is not, so the set is compared without imposing an ordering on it.
    expect([...first.issues.map((issue) => issue.code)].sort()).toEqual([
      'active-with-termination-date',
      'currency-mismatch',
      'duplicate-effective-date',
      'equivalent-mismatch',
      'missing-absence-summary',
      'missing-salary',
      'missing-termination-date',
      'salary-before-hire',
    ]);

    const shape = (result: typeof first) =>
      result.issues.map((issue) => ({
        code: issue.code,
        count: issue.count,
        employeeIds: issue.employeeIds,
      }));

    expect(shape(second)).toEqual(shape(first));
    expect(second.affectedEmployees).toBe(first.affectedEmployees);
  });
});

describe('queryWorkforceSummary and queryRecentChanges (ANA-001)', () => {
  it('splits the workforce by status and the parts sum to the total (ANA-001)', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott', employmentStatus: 'active' });
    await seedEmployee({
      id: 2,
      firstName: 'Ben',
      lastName: 'Baker',
      employmentStatus: 'on_leave',
    });
    await seedEmployee({
      id: 3,
      firstName: 'Cara',
      lastName: 'Carter',
      employmentStatus: 'terminated',
      terminationDate: '2025-12-31',
    });

    const summary = await queryWorkforceSummary(db);

    expect(summary.active).toBe(1);
    expect(summary.onLeave).toBe(1);
    expect(summary.terminated).toBe(1);
    expect(summary.total).toBe(3);
    expect(summary.active + summary.onLeave + summary.terminated).toBe(summary.total);
  });

  it('states the salary before and after a change', async () => {
    await seedEmployee({ id: 1, firstName: 'Ann', lastName: 'Abbott' });

    await seedSalary(1, '2024-01-01', '50000.00', 'USD', {
      createdAt: '2026-01-02 10:00:00+00',
    });
    await seedSalary(1, '2025-06-01', '60000.00', 'USD', {
      createdAt: '2026-01-03 10:00:00+00',
    });

    const changes = await queryRecentChanges(db);

    expect(changes).toHaveLength(2);

    const later = changes.find((change) => change.effectiveFrom === '2025-06-01');
    const first = changes.find((change) => change.effectiveFrom === '2024-01-01');

    expect(later?.baseSalary).toBe('60000.00');
    expect(later?.previousBaseSalary).toBe('50000.00');
    expect(first?.baseSalary).toBe('50000.00');
    expect(first?.previousBaseSalary).toBeNull();
  });
});
