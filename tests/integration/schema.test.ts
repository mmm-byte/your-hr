/**
 * Covers:
 * - EMP-002 unique corporate email
 * - EMP-004 termination date never precedes hire date
 * - EMP-005 an employed employee has no termination date
 * - EMP-006 a terminated employee records when they left
 * - EMP-007 a branch belongs to exactly one country and currency
 * - SAL-002 base salary is positive
 * - SAL-003 bonus percentage stays within 0–100
 * - SAL-006 one salary record per employee per effective date
 * - ABS-001/002 absence summary is internally consistent
 * - PERF-001/002 rating and goals-met stay inside their ranges
 * - ATT-001 attrition reason is a known value
 * - AUD-001/002 an audit event carries actor, action, entity and correlation ID
 * - Foreign keys reject orphaned child rows
 *
 * Does not cover:
 * - The seeded cohort itself (tests/integration/seed.test.ts)
 * - Query shapes and aggregations (Phase 3)
 * - The salary revision workflow and its transaction (Phase 4)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getTestDatabase, resetTestDatabase } from '../setup/integration';

const EMPLOYEE_ID = 1;

/**
 * Return the first row, failing loudly when the query returned none.
 *
 * Asserting on `rows[0]` directly would read `undefined` when the row is
 * missing and produce a confusing "expected undefined to be" message. This
 * helper turns a missing row into an explicit failure.
 */
function firstRow<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error('Expected the query to return at least one row, got none.');
  }
  return row;
}

async function seedBranchAndDepartment() {
  const db = await getTestDatabase();
  await db.exec(`
    insert into departments (id, name) values (1, 'Platform Engineering');
    insert into branches (id, branch_code, name, city, country_code, currency_code)
      values (1, 'US-DAL', 'Dallas Branch', 'Dallas', 'US', 'USD');
  `);
}

async function seedEmployee(overrides: Record<string, string | number | null> = {}) {
  const db = await getTestDatabase();
  const values: Record<string, string | number | null> = {
    id: EMPLOYEE_ID,
    first_name: 'Test',
    last_name: 'Employee',
    email: 'test.employee@corp.example.com',
    department_id: 1,
    job_title: 'Lead, Platform Engineering',
    job_level: 3,
    branch_id: 1,
    country_code: 'US',
    hire_date: '2020-01-01',
    employment_status: 'active',
    gender: 'Male',
    date_of_birth: '1990-01-01',
    work_mode: 'remote',
    ...overrides,
  };
  const columns = Object.keys(values);
  const placeholders = columns.map((_, position) => `$${position + 1}`);
  // PGlite's `query()` takes positional parameters; `exec()` does not accept
  // placeholders at all, so every parameterized statement goes through
  // `query()`.
  await db.query(
    `insert into employees (${columns.join(', ')}) values (${placeholders.join(', ')})`,
    columns.map((column) => values[column] ?? null),
  );
}

beforeEach(async () => {
  await resetTestDatabase();
  await seedBranchAndDepartment();
});

describe('employees', () => {
  it('rejects a duplicate corporate email (EMP-002)', async () => {
    await seedEmployee();
    await expect(seedEmployee({ id: 2, email: 'test.employee@corp.example.com' })).rejects.toThrow(
      /employees_email_unique/,
    );
  });

  it('rejects a termination date before the hire date (EMP-004)', async () => {
    await expect(
      seedEmployee({ employment_status: 'terminated', termination_date: '2019-12-31' }),
    ).rejects.toThrow(/employees_termination_after_hire_check/);
  });

  it('accepts a termination date equal to the hire date (EMP-004 boundary)', async () => {
    await seedEmployee({ employment_status: 'terminated', termination_date: '2020-01-01' });
    const db = await getTestDatabase();
    const result = await db.query<{ termination_date: string }>(
      `select termination_date from employees where id = ${EMPLOYEE_ID}`,
    );
    expect(result.rows).toHaveLength(1);
  });

  it('rejects a termination date on an employee who is still employed (EMP-005)', async () => {
    await expect(seedEmployee({ termination_date: '2021-06-01' })).rejects.toThrow(
      /employees_active_has_no_termination_check/,
    );
  });

  it('rejects a terminated employee without a termination date (EMP-006)', async () => {
    await expect(seedEmployee({ employment_status: 'terminated' })).rejects.toThrow(
      /employees_terminated_requires_termination_check/,
    );
  });

  it('rejects an employment status outside the supported set', async () => {
    await expect(seedEmployee({ employment_status: 'retired' })).rejects.toThrow(
      /employment_status/,
    );
  });

  it('rejects a branch currency outside the supported set (EMP-007)', async () => {
    const db = await getTestDatabase();
    await expect(
      db.exec(`insert into branches (id, branch_code, name, city, country_code, currency_code)
        values (2, 'XX-YYY', 'Nowhere', 'Nowhere', 'US', 'JPY')`),
    ).rejects.toThrow(/currency_code/);
  });
});

describe('salary_records', () => {
  beforeEach(async () => {
    await seedEmployee();
  });

  it('rejects a second salary record with the same effective date (SAL-006)', async () => {
    const db = await getTestDatabase();
    await db.exec(
      `insert into salary_records (employee_id, effective_from, base_salary, bonus_pct, currency_code)
       values (${EMPLOYEE_ID}, '2020-06-01', '50000.00', '10.0', 'USD')`,
    );
    await expect(
      db.exec(
        `insert into salary_records (employee_id, effective_from, base_salary, bonus_pct, currency_code)
         values (${EMPLOYEE_ID}, '2020-06-01', '51000.00', '12.0', 'USD')`,
      ),
    ).rejects.toThrow(/salary_records_employee_effective_unique/);
  });

  it('rejects a non-positive base salary (SAL-002)', async () => {
    const db = await getTestDatabase();
    await expect(
      db.exec(
        `insert into salary_records (employee_id, effective_from, base_salary, bonus_pct, currency_code)
         values (${EMPLOYEE_ID}, '2020-06-01', '0', '10.0', 'USD')`,
      ),
    ).rejects.toThrow(/salary_records_base_salary_positive_check/);
  });

  it('accepts bonus percentages at both ends of the range (SAL-003 boundaries)', async () => {
    const db = await getTestDatabase();
    await db.exec(
      `insert into salary_records (employee_id, effective_from, base_salary, bonus_pct, currency_code)
       values (${EMPLOYEE_ID}, '2020-06-01', '50000.00', '0', 'USD')`,
    );
    await db.exec(
      `insert into salary_records (employee_id, effective_from, base_salary, bonus_pct, currency_code)
       values (${EMPLOYEE_ID}, '2020-07-01', '50000.00', '100', 'USD')`,
    );
    const result = await db.query<{ count: number }>(
      `select count(*)::int as count from salary_records where employee_id = ${EMPLOYEE_ID}`,
    );
    expect(firstRow(result.rows).count).toBe(2);
  });

  it('rejects a bonus percentage above 100 (SAL-003)', async () => {
    const db = await getTestDatabase();
    await expect(
      db.exec(
        `insert into salary_records (employee_id, effective_from, base_salary, bonus_pct, currency_code)
         values (${EMPLOYEE_ID}, '2020-06-01', '50000.00', '100.01', 'USD')`,
      ),
    ).rejects.toThrow(/salary_records_bonus_pct_range_check/);
  });

  it('reads numeric money back as an exact string (MON-002)', async () => {
    const db = await getTestDatabase();
    await db.exec(
      `insert into salary_records (employee_id, effective_from, base_salary, bonus_pct, currency_code)
       values (${EMPLOYEE_ID}, '2020-06-01', '54206.05', '8.80', 'USD')`,
    );
    const result = await db.query<{ base_salary: string; bonus_pct: string }>(
      `select base_salary, bonus_pct from salary_records where employee_id = ${EMPLOYEE_ID}`,
    );
    expect(firstRow(result.rows).base_salary).toBe('54206.05');
    expect(firstRow(result.rows).bonus_pct).toBe('8.80');
  });

  it('rejects a salary row for an employee that does not exist', async () => {
    const db = await getTestDatabase();
    await expect(
      db.exec(
        `insert into salary_records (employee_id, effective_from, base_salary, bonus_pct, currency_code)
         values (9999, '2020-06-01', '50000.00', '10.0', 'USD')`,
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe('supporting summaries', () => {
  beforeEach(async () => {
    await seedEmployee();
  });

  it('rejects an absence summary with no records (SEED-001)', async () => {
    const db = await getTestDatabase();
    await expect(
      db.exec(
        `insert into absence_records (employee_id, record_count, total_days)
         values (${EMPLOYEE_ID}, 0, 0)`,
      ),
    ).rejects.toThrow(/absence_records_record_count_positive_check/);
  });

  it('accepts a summary of records that total zero days (D-019)', async () => {
    const db = await getTestDatabase();
    await db.exec(
      `insert into absence_records (employee_id, record_count, total_days)
       values (${EMPLOYEE_ID}, 1, 0)`,
    );
    const result = await db.query<{ total_days: number }>(
      `select total_days from absence_records where employee_id = ${EMPLOYEE_ID}`,
    );
    expect(firstRow(result.rows).total_days).toBe(0);
  });

  it('rejects a performance rating outside 1–5 (PERF-001)', async () => {
    const db = await getTestDatabase();
    await expect(
      db.exec(
        `insert into performance_reviews (employee_id, review_date, rating, goals_met_pct)
         values (${EMPLOYEE_ID}, '2020-01-01', 9, 50)`,
      ),
    ).rejects.toThrow(/performance_reviews_rating_range_check/);
  });

  it('rejects a goals-met percentage outside 0–100 (PERF-002)', async () => {
    const db = await getTestDatabase();
    await expect(
      db.exec(
        `insert into performance_reviews (employee_id, review_date, rating, goals_met_pct)
         values (${EMPLOYEE_ID}, '2020-01-01', 3, 150)`,
      ),
    ).rejects.toThrow(/performance_reviews_goals_met_range_check/);
  });

  it('rejects an unknown attrition reason (ATT-001)', async () => {
    const db = await getTestDatabase();
    await expect(
      db.exec(
        `insert into attrition_events (employee_id, left_on, reason, voluntary)
         values (${EMPLOYEE_ID}, '2021-01-01', 'unknown_reason', true)`,
      ),
    ).rejects.toThrow(/attrition_reason/);
  });
});

describe('audit_events', () => {
  it('stores an audit event with actor, action, entity and correlation ID (AUD-001, AUD-002)', async () => {
    const db = await getTestDatabase();
    await db.exec(
      `insert into audit_events (actor_id, action, entity_type, entity_id, correlation_id)
       values ('hr-manager', 'salary.revised', 'employee', '1', 'ch_0123456789abcdef0123456789abcdef')`,
    );
    const result = await db.query<{
      actor_id: string;
      action: string;
      correlation_id: string;
    }>(`select actor_id, action, correlation_id from audit_events`);
    expect(result.rows).toHaveLength(1);
    expect(firstRow(result.rows).actor_id).toBe('hr-manager');
    expect(firstRow(result.rows).action).toBe('salary.revised');
    expect(firstRow(result.rows).correlation_id).toMatch(/^ch_[0-9a-f]{32}$/);
  });

  it('rejects an audit event without a correlation ID (AUD-002)', async () => {
    const db = await getTestDatabase();
    await expect(
      db.exec(
        `insert into audit_events (actor_id, action, entity_type, entity_id)
         values ('hr-manager', 'salary.revised', 'employee', '1')`,
      ),
    ).rejects.toThrow(/correlation_id/);
  });
});
