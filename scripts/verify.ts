/**
 * Verify the seeded database against the dataset contract.
 *
 * Purpose: prove the database matches the approved cohort and that every
 * invariant the dataset contract states actually holds in the database.
 * Called by: `pnpm db:verify`.
 * Reads: the target database.
 * Writes: nothing. The script is read-only by design.
 * Rules: DATASET.md (Data invariants before seed is accepted),
 *        scripts/README.md (seed verification must check counts, uniqueness,
 *        foreign keys, salary/date/currency invariants, duplicate effective
 *        dates, and orphan detection).
 *
 * Every check is reported with its expected and actual value. The script
 * exits non-zero when any check fails, so it can gate a release.
 *
 * No row contents are printed — only counts and identifiers needed to
 * diagnose a failure (SECURITY.md, AUD-003).
 */
import { openDatabase, resolveDatabaseTarget, type DatabaseHandle } from './target';

/** One verification check and its outcome. */
interface CheckResult {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
  detail?: string;
}

/** The counts the approved cohort must produce. */
const EXPECTED_COUNTS = {
  employees: 10_000,
  salary_records: 22_093,
  departments: 40,
  branches: 8,
  performance_reviews: 10_000,
  attrition_events: 4_278,
  absence_records: 5_418,
} as const;

/**
 * Run a count query and compare it with the expected value.
 */
async function checkCount(
  database: DatabaseHandle,
  name: string,
  table: string,
  expected: number,
): Promise<CheckResult> {
  const result = await database.query<{ count: number }>(
    `select count(*)::int as count from "${table}"`,
  );
  const actual = result.rows[0]?.count ?? 0;
  return {
    name,
    expected: String(expected),
    actual: String(actual),
    passed: actual === expected,
  };
}

/**
 * Run a scalar query and compare it with the expected value.
 */
async function checkScalar(
  database: DatabaseHandle,
  name: string,
  sql: string,
  expected: number,
  params: readonly unknown[] = [],
): Promise<CheckResult> {
  const result = await database.query<{ value: number }>(sql, params);
  const actual = result.rows[0]?.value ?? 0;
  return {
    name,
    expected: String(expected),
    actual: String(actual),
    passed: actual === expected,
  };
}

/**
 * Confirm a query returns no rows.
 */
async function checkNoRows(
  database: DatabaseHandle,
  name: string,
  sql: string,
  params: readonly unknown[] = [],
): Promise<CheckResult> {
  const result = await database.query(sql, params);
  return {
    name,
    expected: '0 rows',
    actual: `${result.rows.length} rows`,
    passed: result.rows.length === 0,
    detail:
      result.rows.length > 0
        ? `First offending row: ${JSON.stringify(result.rows[0]).slice(0, 200)}`
        : undefined,
  };
}

async function main(): Promise<void> {
  const database = await openDatabase(resolveDatabaseTarget());
  console.log(`Target: ${database.label}\n`);

  const results: CheckResult[] = [];

  try {
    console.log('Row counts');
    for (const [table, expected] of Object.entries(EXPECTED_COUNTS)) {
      results.push(await checkCount(database, `${table} count`, table, expected));
    }

    console.log('Uniqueness');
    results.push(
      await checkScalar(
        database,
        'duplicate employee IDs',
        `select count(*)::int as value from (
           select id from employees group by id having count(*) > 1
         ) duplicates`,
        0,
      ),
    );
    results.push(
      await checkScalar(
        database,
        'duplicate employee emails',
        `select count(*)::int as value from (
           select email from employees group by email having count(*) > 1
         ) duplicates`,
        0,
      ),
    );
    results.push(
      await checkScalar(
        database,
        'duplicate (employee, effective date) salary rows',
        `select count(*)::int as value from (
           select employee_id, effective_from
           from salary_records
           group by employee_id, effective_from
           having count(*) > 1
         ) duplicates`,
        0,
      ),
    );

    console.log('Relationships and orphans');
    results.push(
      await checkNoRows(
        database,
        'orphaned salary rows',
        `select s.employee_id from salary_records s
         left join employees e on e.id = s.employee_id
         where e.id is null`,
      ),
    );
    results.push(
      await checkNoRows(
        database,
        'orphaned absence summaries',
        `select a.employee_id from absence_records a
         left join employees e on e.id = a.employee_id
         where e.id is null`,
      ),
    );
    results.push(
      await checkNoRows(
        database,
        'orphaned reviews',
        `select r.employee_id from performance_reviews r
         left join employees e on e.id = r.employee_id
         where e.id is null`,
      ),
    );
    results.push(
      await checkNoRows(
        database,
        'orphaned attrition events',
        `select a.employee_id from attrition_events a
         left join employees e on e.id = a.employee_id
         where e.id is null`,
      ),
    );
    results.push(
      await checkNoRows(
        database,
        'employees without a branch or department',
        `select e.id from employees e
         left join branches b on b.id = e.branch_id
         left join departments d on d.id = e.department_id
         where b.id is null or d.id is null`,
      ),
    );
    results.push(
      await checkScalar(
        database,
        'employees without a salary record',
        `select count(*)::int as value from employees e
         where not exists (select 1 from salary_records s where s.employee_id = e.id)`,
        0,
      ),
    );

    console.log('Date ranges');
    results.push(
      await checkNoRows(
        database,
        'salary effective before hire date',
        `select s.employee_id from salary_records s
         join employees e on e.id = s.employee_id
         where s.effective_from < e.hire_date`,
      ),
    );
    results.push(
      await checkNoRows(
        database,
        'salary effective after termination date',
        `select s.employee_id from salary_records s
         join employees e on e.id = s.employee_id
         where e.termination_date is not null and s.effective_from > e.termination_date`,
      ),
    );
    results.push(
      await checkNoRows(
        database,
        'termination before hire date',
        `select id from employees
         where termination_date is not null and termination_date < hire_date`,
      ),
    );
    results.push(
      await checkNoRows(
        database,
        'active employee carrying a termination date',
        `select id from employees
         where employment_status <> 'terminated' and termination_date is not null`,
      ),
    );
    results.push(
      await checkNoRows(
        database,
        'terminated employee without a termination date',
        `select id from employees
         where employment_status = 'terminated' and termination_date is null`,
      ),
    );

    console.log('Currency and money');
    results.push(
      await checkNoRows(
        database,
        'salary currency disagrees with the branch currency',
        `select s.employee_id from salary_records s
         join employees e on e.id = s.employee_id
         join branches b on b.id = e.branch_id
         where s.currency_code <> b.currency_code`,
      ),
    );
    results.push(
      await checkScalar(
        database,
        'employees whose salary currency changes across history',
        `select count(*)::int as value from (
           select employee_id from salary_records
           group by employee_id having count(distinct currency_code) > 1
         ) unstable`,
        0,
      ),
    );
    results.push(
      await checkNoRows(
        database,
        'non-positive base salary',
        `select id from salary_records where base_salary <= 0`,
      ),
    );
    results.push(
      await checkNoRows(
        database,
        'bonus percentage outside 0–100',
        `select id from salary_records where bonus_pct < 0 or bonus_pct > 100`,
      ),
    );

    console.log('Seed summary semantics');
    results.push(
      await checkScalar(
        database,
        'absence summaries with no records',
        `select count(*)::int as value from absence_records where record_count <= 0`,
        0,
      ),
    );
    results.push(
      await checkScalar(
        database,
        'employees with more than one absence summary',
        `select count(*)::int as value from (
           select employee_id from absence_records
           group by employee_id having count(*) > 1
         ) duplicates`,
        0,
      ),
    );
    results.push(
      await checkScalar(
        database,
        'employees with more than one performance review',
        `select count(*)::int as value from (
           select employee_id from performance_reviews
           group by employee_id having count(*) > 1
         ) duplicates`,
        0,
      ),
    );
    results.push(
      await checkScalar(
        database,
        'attrition events for employees who are not terminated',
        `select count(*)::int as value from attrition_events a
         join employees e on e.id = a.employee_id
         where e.employment_status <> 'terminated'`,
        0,
      ),
    );

    console.log('Reporting');
    const failed = results.filter((result) => !result.passed);
    for (const result of results) {
      const status = result.passed ? 'PASS' : 'FAIL';
      console.log(
        `  [${status}] ${result.name}: expected ${result.expected}, actual ${result.actual}`,
      );
      if (result.detail) {
        console.log(`         ${result.detail}`);
      }
    }

    console.log(
      `\n${results.length - failed.length}/${results.length} checks passed.`,
    );

    if (failed.length > 0) {
      console.error(`\n${failed.length} verification check(s) failed.`);
      process.exitCode = 1;
    }
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
