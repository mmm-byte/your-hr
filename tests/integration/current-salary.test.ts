/**
 * Covers:
 * - SAL-007 the current salary is the latest record effective on or before the reporting date
 * - SAL-008 a future-effective record is scheduled, never current
 * - RPT-001 the reporting date selects the salary
 * - EMP-009 a terminated employee's history stays fully inspectable
 * - ELG-006 a terminated employee's salary is labelled as-of termination
 * - SEED-001/002 the absence and performance context is a summary, not dated history
 *
 * Does not cover:
 * - The profile UI (tests/component/)
 * - The salary revision workflow (Phase 4)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { getTestDatabase, resetTestDatabase } from '../setup/integration';
import { queryEmployeeProfile, type ProfileDatabase } from '@/db/queries/current-salary';
import { schema } from '@/db/schema';

let pglite: PGlite;
let db: ProfileDatabase;

const EMPLOYEE_ID = 7;

/**
 * Insert the one employee every test reads.
 *
 * The employee is active by default; a test that needs a terminated one
 * updates the row explicitly, so the status is always visible at the call
 * site rather than hidden in an environment variable.
 */
async function seedEmployee(options: { terminatedOn?: string } = {}): Promise<void> {
  const terminatedOn = options.terminatedOn ?? null;

  await pglite.query(`insert into departments (id, name) values (1, 'Payroll')`);
  await pglite.query(
    `insert into branches (id, branch_code, name, city, country_code, currency_code)
     values (1, 'US-NYC', 'New York Branch', 'New York', 'US', 'USD')`,
  );
  await pglite.query(
    `insert into employees
       (id, first_name, last_name, email, department_id, job_title, job_level, branch_id,
        country_code, hire_date, termination_date, employment_status, gender, date_of_birth, work_mode)
     values ($1, 'Ann', 'Abbott', 'ann.abbott@corp.example.com', 1, 'Lead, Payroll', 4, 1,
             'US', '2020-01-01', $2, $3, 'Female', '1990-05-04', 'hybrid')`,
    [EMPLOYEE_ID, terminatedOn, terminatedOn === null ? 'active' : 'terminated'],
  );
}

beforeEach(async () => {
  await resetTestDatabase();
  pglite = await getTestDatabase();
  db = drizzle(pglite, { casing: 'snake_case', schema }) as unknown as ProfileDatabase;
  await seedEmployee();
});

async function seedSalary(
  effectiveFrom: string,
  baseSalary: string,
  options: { usdEquivalent?: string; changeReason?: string } = {},
): Promise<void> {
  await pglite.query(
    `insert into salary_records
       (employee_id, effective_from, base_salary, bonus_pct, currency_code,
        usd_equivalent, localization_method, change_reason)
     values ($1, $2, $3, '5.00', 'USD', $4, 'synthetic_geo_factor_v1', $5)`,
    [
      EMPLOYEE_ID,
      effectiveFrom,
      baseSalary,
      options.usdEquivalent ?? null,
      options.changeReason ?? null,
    ],
  );
}

describe('queryEmployeeProfile', () => {
  it('returns null for an employee that does not exist', async () => {
    const result = await queryEmployeeProfile(db, 999, '2026-01-01');
    expect(result).toBeNull();
  });

  it('returns the employee with their department and branch', async () => {
    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.employee.firstName).toBe('Ann');
    expect(result?.employee.departmentName).toBe('Payroll');
    expect(result?.employee.branchCode).toBe('US-NYC');
    expect(result?.employee.branchCurrencyCode).toBe('USD');
  });

  it('selects the salary effective on or before the reporting date (SAL-007)', async () => {
    await seedSalary('2024-01-01', '50000.00');
    await seedSalary('2025-06-01', '60000.00');

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.currentSalary?.baseSalary).toBe('60000.00');
    expect(result?.currentSalary?.effectiveFrom).toBe('2025-06-01');
  });

  it('selects the earlier salary when the reporting date precedes the revision', async () => {
    await seedSalary('2024-01-01', '50000.00');
    await seedSalary('2025-06-01', '60000.00');

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2025-01-01');
    expect(result?.currentSalary?.baseSalary).toBe('50000.00');
  });

  it('selects the salary effective exactly on the reporting date', async () => {
    await seedSalary('2025-06-01', '60000.00');

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2025-06-01');
    expect(result?.currentSalary?.baseSalary).toBe('60000.00');
  });

  it('has no current salary when every record is in the future', async () => {
    await seedSalary('2030-01-01', '50000.00');

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.currentSalary).toBeNull();
  });

  it('reports a future-effective record as scheduled, not current (SAL-008)', async () => {
    await seedSalary('2024-01-01', '50000.00');
    await seedSalary('2027-03-01', '80000.00');

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.currentSalary?.baseSalary).toBe('50000.00');
    expect(result?.scheduledSalary?.baseSalary).toBe('80000.00');
    expect(result?.scheduledSalary?.effectiveFrom).toBe('2027-03-01');
  });

  it('returns the whole history, newest first', async () => {
    await seedSalary('2023-01-01', '40000.00');
    await seedSalary('2024-01-01', '50000.00');
    await seedSalary('2025-06-01', '60000.00');

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.salaryHistory.map((record) => record.baseSalary)).toEqual([
      '60000.00',
      '50000.00',
      '40000.00',
    ]);
  });

  it('carries the seed localization provenance with each record (MON-005)', async () => {
    await seedSalary('2024-01-01', '50000.00', { usdEquivalent: '52000.00' });

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.currentSalary?.usdEquivalent).toBe('52000.00');
    expect(result?.currentSalary?.localizationMethod).toBe('synthetic_geo_factor_v1');
  });

  it('carries the change reason on an application-created record (SAL-009)', async () => {
    await seedSalary('2024-01-01', '50000.00', { changeReason: 'Annual review' });

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.currentSalary?.changeReason).toBe('Annual review');
  });
});

describe('seed summaries (SEED-001, SEED-002, D-018)', () => {
  it('returns the absence summary, not dated events', async () => {
    await pglite.query(
      `insert into absence_records (employee_id, record_count, total_days)
       values ($1, 3, 14)`,
      [EMPLOYEE_ID],
    );

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.absence).toEqual({ recordCount: 3, totalDays: 14 });
  });

  it('returns no absence summary when the employee has no absence records', async () => {
    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.absence).toBeNull();
  });

  it('returns the latest performance review', async () => {
    await pglite.query(
      `insert into performance_reviews (employee_id, review_date, rating, goals_met_pct)
       values ($1, '2026-03-03', 4, 83)`,
      [EMPLOYEE_ID],
    );

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.performance).toEqual({
      reviewDate: '2026-03-03',
      rating: 4,
      goalsMetPct: 83,
      promotionRecommended: false,
    });
  });

  it('returns no performance summary when there is no review', async () => {
    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.performance).toBeNull();
  });

  it('returns the attrition event for a terminated employee', async () => {
    await pglite.query(
      `update employees set employment_status = 'terminated', termination_date = '2025-12-31'
       where id = $1`,
      [EMPLOYEE_ID],
    );
    await pglite.query(
      `insert into attrition_events (employee_id, left_on, reason, voluntary)
       values ($1, '2025-12-31', 'better_offer', true)`,
      [EMPLOYEE_ID],
    );

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.attrition).toEqual({
      leftOn: '2025-12-31',
      reason: 'better_offer',
      voluntary: true,
      exitInterviewScore: null,
    });
  });
});

describe('terminated employees (EMP-009, ELG-006)', () => {
  /**
   * Re-seed the employee as terminated.
   *
   * The `beforeEach` already inserted the active row, so the row is updated
   * rather than inserted again.
   */
  async function terminateEmployee(): Promise<void> {
    await pglite.query(
      `update employees set employment_status = 'terminated', termination_date = '2025-12-31'
       where id = $1`,
      [EMPLOYEE_ID],
    );
  }

  it('keeps the salary history fully inspectable', async () => {
    await terminateEmployee();
    await seedSalary('2024-01-01', '50000.00');
    await seedSalary('2025-06-01', '60000.00');

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.salaryHistory).toHaveLength(2);
    expect(result?.employee.terminationDate).toBe('2025-12-31');
  });

  it('reports the salary as-of the termination date when the reporting date is later', async () => {
    await terminateEmployee();
    await seedSalary('2025-06-01', '60000.00');

    const result = await queryEmployeeProfile(db, EMPLOYEE_ID, '2026-01-01');
    expect(result?.currentSalary?.baseSalary).toBe('60000.00');
    expect(result?.currentSalary?.effectiveFrom).toBe('2025-06-01');
  });
});
