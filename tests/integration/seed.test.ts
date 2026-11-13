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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createSeededDatabase } from '../fixtures/seeded-database';

let client: PGlite;

beforeAll(async () => {
  client = await createSeededDatabase();
});

afterAll(async () => {
  await client?.close();
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
