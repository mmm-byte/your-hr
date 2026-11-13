/**
 * Covers:
 * - The approved cohort loads with the exact expected row counts
 * - Every employee has at least one salary record (SAL-001)
 * - No salary record predates the hire date or postdates termination
 *   (SAL-004)
 * - One effective date per employee (SAL-006)
 * - Salary currency matches the employee's branch currency (EMP-007)
 * - Currency never changes across an employee's history (SEED-004)
 * - A terminated employee has an attrition event; an employed one does not
 *   (ATT-001)
 * - Absence summaries exist only for employees who have absence records
 *   (SEED-001, D-019)
 * - The current salary as of the reporting date is the latest effective
 *   record on or before that date (SAL-007)
 * - Money reads back as an exact decimal string (MON-002)
 *
 * Does not cover:
 * - Schema constraints (tests/integration/schema.test.ts)
 * - CSV parsing and the dataset mapping rules
 *   (tests/unit/csv.test.ts, tests/unit/seed-dataset.test.ts)
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { parseCsv } from '../../scripts/csv';
import { buildSeedDataset } from '../../scripts/seed-dataset';
import { pgliteDateParsers } from '../../src/db/date-parsers';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const datasetFolder = join(projectRoot, 'Dataset');

let client: PGlite;

/**
 * Insert rows using a single multi-row statement.
 */
async function insertRows(
  table: string,
  columns: readonly string[],
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  const columnList = columns.map((column) => `"${column}"`).join(', ');
  for (let offset = 0; offset < rows.length; offset += 500) {
    const chunk = rows.slice(offset, offset + 500);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(row[column] ?? null);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `insert into "${table}" (${columnList}) values ${tuples.join(', ')}`,
      values,
    );
  }
}

beforeAll(async () => {
  // The parsers match the production Neon configuration, so a `date` column
  // arrives as raw `YYYY-MM-DD` text in tests exactly as it does in
  // production (RPT-004, D-021).
  client = await PGlite.create(undefined, { parsers: pgliteDateParsers });

  // Apply the committed migrations, exactly as the runtime does.
  const { readdir } = await import('node:fs/promises');
  const migrationsFolder = join(projectRoot, 'drizzle');
  const files = (await readdir(migrationsFolder))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = await readFile(join(migrationsFolder, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed !== '') {
        await client.exec(trimmed);
      }
    }
  }

  const [masterText, salaryText] = await Promise.all([
    readFile(
      join(datasetFolder, 'hr_employee_master_10000_multicountry_final.csv'),
      'utf8',
    ),
    readFile(join(datasetFolder, 'salaries_10000_multicountry_localized_final.csv'), 'utf8'),
  ]);

  const dataset = buildSeedDataset(parseCsv(masterText), parseCsv(salaryText));

  await insertRows(
    'departments',
    ['id', 'name'],
    dataset.departments.map((row) => ({ id: row.id, name: row.name })),
  );
  await insertRows(
    'branches',
    ['id', 'branch_code', 'name', 'city', 'country_code', 'currency_code'],
    dataset.branches.map((row) => ({
      id: row.id,
      branch_code: row.branchCode,
      name: row.name,
      city: row.city,
      country_code: row.countryCode,
      currency_code: row.currencyCode,
    })),
  );
  await insertRows(
    'employees',
    [
      'id',
      'first_name',
      'last_name',
      'email',
      'department_id',
      'job_title',
      'job_level',
      'branch_id',
      'country_code',
      'hire_date',
      'termination_date',
      'employment_status',
      'gender',
      'date_of_birth',
      'work_mode',
    ],
    dataset.employees.map((row) => ({
      id: row.id,
      first_name: row.firstName,
      last_name: row.lastName,
      email: row.email,
      department_id: row.departmentId,
      job_title: row.jobTitle,
      job_level: row.jobLevel,
      branch_id: row.branchId,
      country_code: row.countryCode,
      hire_date: row.hireDate,
      termination_date: row.terminationDate,
      employment_status: row.employmentStatus,
      gender: row.gender,
      date_of_birth: row.dateOfBirth,
      work_mode: row.workMode,
    })),
  );
  await insertRows(
    'salary_records',
    [
      'employee_id',
      'effective_from',
      'base_salary',
      'bonus_pct',
      'currency_code',
      'source_base_salary_usd',
      'usd_equivalent',
      'geo_salary_factor',
      'usd_to_local_fx',
      'fx_reference_date',
      'localization_method',
    ],
    dataset.salaries.map((row) => ({
      employee_id: row.employeeId,
      effective_from: row.effectiveFrom,
      base_salary: row.baseSalary,
      bonus_pct: row.bonusPct,
      currency_code: row.currencyCode,
      source_base_salary_usd: row.sourceBaseSalaryUsd,
      usd_equivalent: row.usdEquivalent,
      geo_salary_factor: row.geoSalaryFactor,
      usd_to_local_fx: row.usdToLocalFx,
      fx_reference_date: row.fxReferenceDate,
      localization_method: row.localizationMethod,
    })),
  );
  await insertRows(
    'absence_records',
    ['employee_id', 'record_count', 'total_days'],
    dataset.absences.map((row) => ({
      employee_id: row.employeeId,
      record_count: row.recordCount,
      total_days: row.totalDays,
    })),
  );
  await insertRows(
    'performance_reviews',
    ['employee_id', 'review_date', 'rating', 'goals_met_pct', 'promotion_recommended'],
    dataset.reviews.map((row) => ({
      employee_id: row.employeeId,
      review_date: row.reviewDate,
      rating: row.rating,
      goals_met_pct: row.goalsMetPct,
      promotion_recommended: row.promotionRecommended,
    })),
  );
  await insertRows(
    'attrition_events',
    ['employee_id', 'left_on', 'reason', 'voluntary', 'exit_interview_score'],
    dataset.attritions.map((row) => ({
      employee_id: row.employeeId,
      left_on: row.leftOn,
      reason: row.reason,
      voluntary: row.voluntary,
      exit_interview_score: row.exitInterviewScore,
    })),
  );
});

describe('the seeded cohort', () => {
  it('loads the exact expected row counts', async () => {
    const counts = await client.query<{ table_name: string; count: number }>(`
      select 'employees' as table_name, count(*)::int as count from employees
      union all select 'salary_records', count(*)::int from salary_records
      union all select 'departments', count(*)::int from departments
      union all select 'branches', count(*)::int from branches
      union all select 'absence_records', count(*)::int from absence_records
      union all select 'performance_reviews', count(*)::int from performance_reviews
      union all select 'attrition_events', count(*)::int from attrition_events
      order by table_name
    `);

    expect(Object.fromEntries(counts.rows.map((row) => [row.table_name, row.count]))).toEqual({
      absence_records: 5_418,
      attrition_events: 4_278,
      branches: 8,
      departments: 40,
      employees: 10_000,
      performance_reviews: 10_000,
      salary_records: 22_093,
    });
  });

  it('gives every employee at least one salary record (SAL-001)', async () => {
    const result = await client.query<{ count: number }>(`
      select count(*)::int as count from employees e
      where not exists (select 1 from salary_records s where s.employee_id = e.id)
    `);
    expect(result.rows[0]?.count).toBe(0);
  });

  it('never dates a salary before the hire date or after termination (SAL-004)', async () => {
    const result = await client.query<{ count: number }>(`
      select count(*)::int as count from salary_records s
      join employees e on e.id = s.employee_id
      where s.effective_from < e.hire_date
         or (e.termination_date is not null and s.effective_from > e.termination_date)
    `);
    expect(result.rows[0]?.count).toBe(0);
  });

  it('keeps one effective date per employee (SAL-006)', async () => {
    const result = await client.query<{ count: number }>(`
      select count(*)::int as count from (
        select employee_id, effective_from from salary_records
        group by employee_id, effective_from having count(*) > 1
      ) duplicates
    `);
    expect(result.rows[0]?.count).toBe(0);
  });

  it('matches the salary currency to the branch currency (EMP-007)', async () => {
    const result = await client.query<{ count: number }>(`
      select count(*)::int as count from salary_records s
      join employees e on e.id = s.employee_id
      join branches b on b.id = e.branch_id
      where s.currency_code <> b.currency_code
    `);
    expect(result.rows[0]?.count).toBe(0);
  });

  it('never changes an employee currency across their history (SEED-004)', async () => {
    const result = await client.query<{ count: number }>(`
      select count(*)::int as count from (
        select employee_id from salary_records
        group by employee_id having count(distinct currency_code) > 1
      ) unstable
    `);
    expect(result.rows[0]?.count).toBe(0);
  });

  it('records an attrition event only for terminated employees (ATT-001)', async () => {
    const missing = await client.query<{ count: number }>(`
      select count(*)::int as count from employees e
      where e.employment_status = 'terminated'
        and not exists (select 1 from attrition_events a where a.employee_id = e.id)
    `);
    const extra = await client.query<{ count: number }>(`
      select count(*)::int as count from attrition_events a
      join employees e on e.id = a.employee_id
      where e.employment_status <> 'terminated'
    `);
    expect(missing.rows[0]?.count).toBe(0);
    expect(extra.rows[0]?.count).toBe(0);
  });

  it('stores an absence summary only for employees who have absence records (SEED-001)', async () => {
    const result = await client.query<{ count: number }>(`
      select count(*)::int as count from absence_records where record_count <= 0
    `);
    expect(result.rows[0]?.count).toBe(0);
  });

  it('reads money back as an exact decimal string (MON-002)', async () => {
    const result = await client.query<{ base_salary: string; bonus_pct: string }>(`
      select base_salary, bonus_pct from salary_records
      where base_salary <> '0' and bonus_pct <> '0'
      order by employee_id, effective_from limit 1
    `);
    const row = result.rows[0];
    expect(row).toBeDefined();
    expect(row?.base_salary).toMatch(/^\d+\.\d{2}$/);
    expect(row?.bonus_pct).toMatch(/^\d+\.\d{2}$/);
  });

  it('selects the salary effective on a reporting date, not the newest row (SAL-007)', async () => {
    // Employee 8 has three records; 2023-04-24 and 2023-05-09 are in the
    // past and 2026-07-01 is later still.
    const result = await client.query<{ effective_from: string; base_salary: string }>(`
      select effective_from, base_salary from salary_records
      where employee_id = 8 and effective_from <= '2024-01-01'
      order by effective_from desc limit 1
    `);
    expect(result.rows[0]?.effective_from).toBe('2023-05-09');

    const later = await client.query<{ effective_from: string }>(`
      select effective_from from salary_records
      where employee_id = 8 and effective_from <= '2027-01-01'
      order by effective_from desc limit 1
    `);
    expect(later.rows[0]?.effective_from).toBe('2026-07-01');
  });

  it('distinguishes no absence records from zero absence days (D-019)', async () => {
    const result = await client.query<{ count: number }>(`
      select count(*)::int as count from employees e
      where not exists (select 1 from absence_records a where a.employee_id = e.id)
    `);
    // 10,000 employees minus the 5,418 that carry an absence summary.
    expect(result.rows[0]?.count).toBe(4_582);
  });
});
