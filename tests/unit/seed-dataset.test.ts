/**
 * Covers:
 * - Department names are recovered from the job-title suffix (D-021)
 * - The department-to-name mapping must be strictly 1:1
 * - A duplicate employee ID is rejected
 * - A termination date before the hire date is rejected
 * - A terminated employee without a termination date is rejected
 * - An employed employee carrying a termination date is rejected
 * - A blank absence summary produces no row, a present one produces a row
 *   (D-019, SEED-001)
 * - A salary effective before the hire date is rejected
 * - A salary effective after the termination date is rejected
 * - Two salary rows with the same effective date are rejected (SAL-006)
 * - A currency change across an employee's history is rejected (SEED-004)
 * - A salary row for an unknown employee is rejected
 * - An employee with no salary record is rejected (SAL-001)
 *
 * Does not cover:
 * - Writing the rows to a database (tests/integration/seed.test.ts)
 * - CSV parsing itself (tests/unit/csv.test.ts)
 */
import { describe, expect, it } from 'vitest';
import {
  assertDepartmentMapping,
  buildSeedDataset,
  departmentNameFromJobTitle,
} from '../../scripts/seed-dataset';
import { parseCsv } from '../../scripts/csv';

const MASTER_HEADER =
  'employee_id,first_name,last_name,email,department_id,job_title,job_level,branch_code,' +
  'branch_name,branch_city,country_code,local_currency,hire_date,termination_date,' +
  'employment_status,gender,date_of_birth,work_mode,absence_record_count,total_absence_days,' +
  'latest_review_date,latest_rating,latest_goals_met_pct,latest_promotion_recommended,' +
  'attrition_date,attrition_reason,attrition_voluntary,exit_interview_score';

const SALARY_HEADER =
  'salary_id,employee_id,effective_from,source_base_salary_usd,bonus_pct,source_currency,' +
  'country_code,branch_code,local_currency,geo_salary_factor,usd_to_local_fx,' +
  'localized_base_salary_usd_equivalent,localized_base_salary,currency,localization_method,' +
  'fx_reference_date';

/** A master row with every column, so a test can override one field. */
function masterRow(overrides: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    employee_id: '1',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@corp.example.com',
    department_id: '1',
    job_title: 'Lead, Platform Engineering',
    job_level: '3',
    branch_code: 'US-DAL',
    branch_name: 'Dallas Branch',
    branch_city: 'Dallas',
    country_code: 'US',
    local_currency: 'USD',
    hire_date: '2020-01-01',
    termination_date: '',
    employment_status: 'active',
    gender: 'Female',
    date_of_birth: '1990-01-01',
    work_mode: 'remote',
    absence_record_count: '3',
    total_absence_days: '14',
    latest_review_date: '2021-06-01',
    latest_rating: '4',
    latest_goals_met_pct: '80',
    latest_promotion_recommended: '1',
    attrition_date: '',
    attrition_reason: '',
    attrition_voluntary: '',
    exit_interview_score: '',
    ...overrides,
  };
  return MASTER_HEADER.split(',')
    .map((column) => {
      const value = values[column] ?? '';
      return value.includes(',') ? `"${value}"` : value;
    })
    .join(',');
}

/** A salary row with every column. */
function salaryRow(overrides: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    salary_id: '1',
    employee_id: '1',
    effective_from: '2020-06-01',
    source_base_salary_usd: '50000.00',
    bonus_pct: '8.0',
    source_currency: 'USD',
    country_code: 'US',
    branch_code: 'US-DAL',
    local_currency: 'USD',
    geo_salary_factor: '1.0',
    usd_to_local_fx: '1.0',
    localized_base_salary_usd_equivalent: '50000.00',
    localized_base_salary: '50000.00',
    currency: 'USD',
    localization_method: 'synthetic_geo_factor_v1',
    fx_reference_date: '2026-11-05',
    ...overrides,
  };
  return SALARY_HEADER.split(',')
    .map((column) => values[column] ?? '')
    .join(',');
}

/**
 * Build a dataset from the supplied raw rows.
 */
function build(masterRows: string[], salaryRows: string[]) {
  const masterText = masterRows.length
    ? `${MASTER_HEADER}\n${masterRows.join('\n')}\n`
    : `${MASTER_HEADER}\n`;
  const salaryText = salaryRows.length
    ? `${SALARY_HEADER}\n${salaryRows.join('\n')}\n`
    : `${SALARY_HEADER}\n`;
  return buildSeedDataset(parseCsv(masterText), parseCsv(salaryText));
}

describe('departmentNameFromJobTitle', () => {
  it('takes the text after the first comma', () => {
    expect(departmentNameFromJobTitle('Senior Specialist, Accounting')).toBe('Accounting');
  });

  it('rejects a title with no department suffix', () => {
    expect(() => departmentNameFromJobTitle('Chief Executive Officer')).toThrow(
      /no department suffix/,
    );
  });
});

describe('assertDepartmentMapping', () => {
  it('accepts a strictly 1:1 mapping', () => {
    expect(() =>
      assertDepartmentMapping([
        { departmentId: 1, jobTitle: 'Lead, Platform Engineering' },
        { departmentId: 2, jobTitle: 'Associate, Data Science' },
      ]),
    ).not.toThrow();
  });

  it('rejects one department owning two different names', () => {
    expect(() =>
      assertDepartmentMapping([
        { departmentId: 1, jobTitle: 'Lead, Platform Engineering' },
        { departmentId: 1, jobTitle: 'Lead, Data Science' },
      ]),
    ).toThrow(/maps to both/);
  });

  it('rejects two departments sharing one name', () => {
    expect(() =>
      assertDepartmentMapping([
        { departmentId: 1, jobTitle: 'Lead, Platform Engineering' },
        { departmentId: 2, jobTitle: 'Lead, Platform Engineering' },
      ]),
    ).toThrow(/maps to both department/);
  });
});

describe('buildSeedDataset', () => {
  it('maps one employee, one salary record and the derived dimensions', () => {
    const dataset = build([masterRow()], [salaryRow()]);

    expect(dataset.employees).toHaveLength(1);
    expect(dataset.salaries).toHaveLength(1);
    expect(dataset.departments).toEqual([{ id: 1, name: 'Platform Engineering' }]);
    expect(dataset.branches).toHaveLength(1);
    expect(dataset.branches[0]?.branchCode).toBe('US-DAL');
    expect(dataset.branches[0]?.currencyCode).toBe('USD');
    expect(dataset.employees[0]?.email).toBe('ada@corp.example.com');
    expect(dataset.salaries[0]?.baseSalary).toBe('50000.00');
  });

  it('rejects a duplicate employee ID', () => {
    expect(() =>
      build([masterRow(), masterRow({ email: 'other@corp.example.com' })], [salaryRow()]),
    ).toThrow(/Duplicate employee ID 1/);
  });

  it('rejects a termination date before the hire date', () => {
    expect(() =>
      build(
        [masterRow({ employment_status: 'terminated', termination_date: '2019-12-31' })],
        [salaryRow()],
      ),
    ).toThrow(/terminates .* before being hired/);
  });

  it('rejects a terminated employee without a termination date', () => {
    expect(() => build([masterRow({ employment_status: 'terminated' })], [salaryRow()])).toThrow(
      /terminated but has no termination date/,
    );
  });

  it('rejects an employed employee carrying a termination date', () => {
    expect(() =>
      build([masterRow({ employment_status: 'active', termination_date: '2021-01-01' })], [
        salaryRow(),
      ]),
    ).toThrow(/carries a termination date/);
  });

  it('stores no absence row when the source summary is blank (D-019)', () => {
    const dataset = build(
      [masterRow({ absence_record_count: '', total_absence_days: '' })],
      [salaryRow()],
    );
    expect(dataset.absences).toHaveLength(0);
  });

  it('stores one absence row when the source summary is present (SEED-001)', () => {
    const dataset = build([masterRow()], [salaryRow()]);
    expect(dataset.absences).toEqual([{ employeeId: 1, recordCount: 3, totalDays: 14 }]);
  });

  it('rejects a partial absence summary', () => {
    expect(() =>
      build([masterRow({ absence_record_count: '3', total_absence_days: '' })], [salaryRow()]),
    ).toThrow(/partial absence summary/);
  });

  it('rejects a salary effective before the hire date', () => {
    expect(() => build([masterRow()], [salaryRow({ effective_from: '2019-12-31' })])).toThrow(
      /before hire date/,
    );
  });

  it('rejects a salary effective after the termination date', () => {
    expect(() =>
      build(
        [masterRow({ employment_status: 'terminated', termination_date: '2020-03-01' })],
        [salaryRow({ effective_from: '2020-06-01' })],
      ),
    ).toThrow(/after termination/);
  });

  it('rejects two salary rows with the same effective date (SAL-006)', () => {
    expect(() =>
      build([masterRow()], [salaryRow({ salary_id: '1' }), salaryRow({ salary_id: '2' })]),
    ).toThrow(/two salary rows effective 2020-06-01/);
  });

  it('rejects a currency change across an employee history (SEED-004)', () => {
    expect(() =>
      build(
        [masterRow()],
        [
          salaryRow({ salary_id: '1', effective_from: '2020-06-01' }),
          salaryRow({
            salary_id: '2',
            effective_from: '2021-06-01',
            currency: 'EUR',
            localized_base_salary: '45000.00',
          }),
        ],
      ),
    ).toThrow(/changes currency from USD to EUR/);
  });

  it('rejects a salary row for an unknown employee', () => {
    expect(() => build([masterRow()], [salaryRow({ employee_id: '999' })])).toThrow(
      /unknown employee 999/,
    );
  });

  it('rejects an employee with no salary record (SAL-001)', () => {
    expect(() => build([masterRow()], [])).toThrow(/has no salary record/);
  });

  it('records an attrition event only for a terminated employee', () => {
    const dataset = build(
      [
        masterRow({
          employment_status: 'terminated',
          termination_date: '2021-01-31',
          attrition_date: '2021-01-31',
          attrition_reason: 'better_offer',
          attrition_voluntary: '1.0',
          exit_interview_score: '7',
        }),
      ],
      [salaryRow()],
    );
    expect(dataset.attritions).toEqual([
      {
        employeeId: 1,
        leftOn: '2021-01-31',
        reason: 'better_offer',
        voluntary: true,
        exitInterviewScore: 7,
      },
    ]);
  });
});
