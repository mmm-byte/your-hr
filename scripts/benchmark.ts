/**
 * Measure the user-critical query paths (docs/PERFORMANCE.md).
 *
 * Purpose: record **measured** timings for the six paths the product names as
 * user-critical, so the performance claims in `docs/PERFORMANCE.md` are
 * observations rather than estimates (Phase 6, item 6.3).
 *
 * Called by: `pnpm db:benchmark`.
 * Reads: the target database (a seeded 10,000-person cohort).
 * Writes: nothing. The script is read-only by construction — every statement
 *         is a `SELECT`.
 * Rules: ENVIRONMENT.md (server-only secrets — the connection string is
 *        redacted), D-009 (PGlite is a local target, never production).
 *
 * Design notes
 * ------------
 * - **A timing range, not one number.** Each path is measured repeatedly and
 *   the fastest, the median, and the slowest are reported. A single sample
 *   measures the scheduler, not the query.
 * - **The plan is captured too.** A timing without a plan says how long a
 *   query took and nothing about why. `EXPLAIN (ANALYZE, BUFFERS)` records
 *   the index the planner chose and the rows it touched.
 * - **The path is named, not the SQL.** The label is the user action the
 *   query serves, so the record stays meaningful when the SQL changes.
 * - **Nothing is written.** There is no `INSERT`, `UPDATE`, or `DELETE` in
 *   this file, so it is safe to point at a database that holds real data.
 */
import { openDatabase, resolveDatabaseTarget, type DatabaseHandle } from './target';

/** One measured path. */
interface Path {
  readonly name: string;
  readonly budgetMs: number;
  readonly why: string;
  readonly sql: string;
  readonly params: readonly unknown[];
}

/**
 * The paths the product names as user-critical.
 *
 * These are the statements the application actually issues, in the shape it
 * issues them, so the measurement reflects the production query rather than
 * an idealised one.
 */
const PATHS: readonly Path[] = [
  {
    name: 'Directory first page (no filters)',
    budgetMs: 300,
    why: 'The first impression of the product',
    sql: `
      select e.id, e.first_name, e.last_name, e.email, e.job_title, e.job_level,
             e.employment_status, e.work_mode, e.country_code,
             d.name as department_name, b.branch_code, b.name as branch_name, b.city,
             sr.base_salary, sr.bonus_pct, sr.currency_code, sr.usd_equivalent
      from employees e
      join departments d on d.id = e.department_id
      join branches b on b.id = e.branch_id
      left join salary_records sr on sr.employee_id = e.id
        and sr.effective_from = (
          select max(sr2.effective_from) from salary_records sr2
          where sr2.employee_id = e.id and sr2.effective_from <= current_date
        )
      order by e.last_name, e.first_name, e.id
      limit 25
    `,
    params: [],
  },
  {
    name: 'Directory filtered + sorted page',
    budgetMs: 500,
    why: 'The most common repeated action',
    sql: `
      select e.id, e.first_name, e.last_name, e.email, e.job_title, e.job_level,
             e.employment_status, e.work_mode, e.country_code,
             d.name as department_name, b.branch_code, b.name as branch_name, b.city,
             sr.base_salary, sr.bonus_pct, sr.currency_code, sr.usd_equivalent
      from employees e
      join departments d on d.id = e.department_id
      join branches b on b.id = e.branch_id
      left join salary_records sr on sr.employee_id = e.id
        and sr.effective_from = (
          select max(sr2.effective_from) from salary_records sr2
          where sr2.employee_id = e.id and sr2.effective_from <= current_date
        )
      where e.country_code = 'US'
        and e.employment_status = 'active'
        and (e.first_name || ' ' || e.last_name) ilike '%a%'
      order by sr.usd_equivalent desc, e.id
      limit 25
    `,
    params: [],
  },
  {
    name: 'Employee profile with current salary',
    budgetMs: 250,
    why: 'A single-employee lookup should feel instant',
    sql: `
      select e.id, e.first_name, e.last_name, e.email, e.job_title, e.job_level,
             e.employment_status, e.work_mode, e.gender, e.country_code,
             e.hire_date, e.termination_date, e.date_of_birth, e.version,
             d.name as department_name, b.branch_code, b.name as branch_name,
             b.city, b.currency_code as branch_currency_code
      from employees e
      join departments d on d.id = e.department_id
      join branches b on b.id = e.branch_id
      where e.id = $1
    `,
    params: [2521],
  },
  {
    name: 'Salary history',
    budgetMs: 200,
    why: 'Small by construction',
    sql: `
      select id, employee_id, effective_from, base_salary, bonus_pct, currency_code,
             usd_equivalent, localization_method, change_reason, created_at
      from salary_records
      where employee_id = $1
      order by effective_from desc
    `,
    params: [2521],
  },
  {
    name: 'Key analytics aggregate (grouped by currency)',
    budgetMs: 800,
    why: 'A cross-10,000-row aggregate, database-side',
    sql: `
      select currency_code,
             count(*) as headcount,
             percentile_cont(0.5) within group (order by base_salary) as median,
             avg(base_salary) as average,
             min(base_salary) as lowest,
             max(base_salary) as highest
      from salary_records
      where effective_from <= current_date
      group by currency_code
      order by currency_code
    `,
    params: [],
  },
  {
    name: 'Workforce count (overview)',
    budgetMs: 200,
    why: 'The first figure on the landing page',
    sql: `select count(*) as total from employees`,
    params: [],
  },
];

/** How many times each path is measured. */
const SAMPLES = 7;

/** One measurement. */
interface Measurement {
  readonly name: string;
  readonly budgetMs: number;
  readonly why: string;
  readonly samples: number;
  readonly fastestMs: number;
  readonly medianMs: number;
  readonly slowestMs: number;
  readonly withinBudget: boolean;
  readonly plan: string;
}

/**
 * Measure one path.
 *
 * The first run is discarded: it pays for the connection's first round trip
 * and for the plan cache being cold, so it measures the server warming up
 * rather than the query.
 */
async function measure(db: DatabaseHandle, path: Path): Promise<Measurement> {
  // Warm-up, discarded.
  await db.query(path.sql, path.params);

  const timings: number[] = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    const started = performance.now();
    await db.query(path.sql, path.params);
    timings.push(performance.now() - started);
  }

  timings.sort((a, b) => a - b);
  const fastest = timings[0] as number;
  const slowest = timings[timings.length - 1] as number;
  const median = timings[Math.floor(timings.length / 2)] as number;

  return {
    name: path.name,
    budgetMs: path.budgetMs,
    why: path.why,
    samples: SAMPLES,
    fastestMs: round(fastest),
    medianMs: round(median),
    slowestMs: round(slowest),
    withinBudget: median <= path.budgetMs,
    plan: await explain(db, path),
  };
}

/**
 * The query plan.
 *
 * `EXPLAIN (ANALYZE, BUFFERS)` runs the statement, so it is a second
 * execution — cheap, and it is the only way to see which index the planner
 * chose and how many rows it touched.
 */
async function explain(db: DatabaseHandle, path: Path): Promise<string> {
  try {
    const result = await db.query<{ 'QUERY PLAN': string }>(
      `EXPLAIN (ANALYZE, BUFFERS) ${path.sql}`,
      path.params,
    );
    return result.rows.map((row) => row['QUERY PLAN']).join('\n');
  } catch (error) {
    return `EXPLAIN failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** Round to two decimal places, for a readable record. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

async function main(): Promise<void> {
  const target = resolveDatabaseTarget();
  const db = await openDatabase(target);

  console.log(`Benchmark target: ${target.label}`);
  console.log(`Samples per path: ${SAMPLES} (plus one discarded warm-up)`);
  console.log('');

  const results: Measurement[] = [];

  for (const path of PATHS) {
    const measurement = await measure(db, path);
    results.push(measurement);

    const verdict = measurement.withinBudget ? 'within budget' : 'OVER BUDGET';
    console.log(`${measurement.name}`);
    console.log(
      `  fastest ${measurement.fastestMs} ms · median ${measurement.medianMs} ms · slowest ${measurement.slowestMs} ms` +
        ` (budget ${measurement.budgetMs} ms — ${verdict})`,
    );
    console.log('');
  }

  console.log('Query plans');
  console.log('===========');
  for (const result of results) {
    console.log('');
    console.log(`--- ${result.name} ---`);
    console.log(result.plan);
  }

  const overBudget = results.filter((result) => !result.withinBudget);
  console.log('');
  console.log(
    `${results.length - overBudget.length}/${results.length} paths are within their budget.`,
  );
  if (overBudget.length > 0) {
    console.log(
      'A path over budget needs either an optimisation with a recorded reason, or a documented exception.',
    );
  }

  await db.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
