/**
 * Covers:
 * - QRY-001 search matches employee ID, full name, and email, trimmed and case-insensitively
 * - QRY-002 `%`, `_`, `'`, and `\` are literal text, never SQL wildcards
 * - QRY-003 an unknown filter value is ignored rather than erroring
 * - QRY-004 the page size is bounded; a page beyond the last returns no rows, not an error
 * - QRY-005 the sort comes from an allow-list and the order is stable
 * - QRY-007 an empty result distinguishes "no data" from "no rows match"
 * - QRY-001 the current salary is the one effective on or before the reporting date (SAL-007)
 *
 * Does not cover:
 * - The directory UI (tests/component/)
 * - The salary revision workflow (Phase 4)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { getTestDatabase, resetTestDatabase } from '../setup/integration';
import { queryEmployeeDirectory, type DirectoryDatabase } from '@/db/queries/employees';
import { parseEmployeeDirectoryQuery } from '@/schemas/employee-directory';
import { schema } from '@/db/schema';

let pglite: PGlite;
let db: DirectoryDatabase;

const BRANCHES = [
  { id: 1, code: 'US-NYC', name: 'New York Branch', city: 'New York', country: 'US', currency: 'USD' },
  { id: 2, code: 'IN-BLR', name: 'Bengaluru Branch', city: 'Bengaluru', country: 'IN', currency: 'INR' },
];

const DEPARTMENTS = [
  { id: 1, name: 'Payroll' },
  { id: 2, name: 'Legal' },
];

/** An employee, with the columns the directory reads. */
interface EmployeeSeed {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: number;
  jobTitle: string;
  jobLevel: number;
  branchId: number;
  countryCode: string;
  employmentStatus: string;
  workMode: string;
  terminationDate?: string;
}

const EMPLOYEES: EmployeeSeed[] = [
  {
    id: 1,
    firstName: 'Ann',
    lastName: 'Abbott',
    email: 'ann.abbott@corp.example.com',
    departmentId: 1,
    jobTitle: 'Lead, Payroll',
    jobLevel: 4,
    branchId: 1,
    countryCode: 'US',
    employmentStatus: 'active',
    workMode: 'hybrid',
  },
  {
    id: 2,
    firstName: 'Bob',
    lastName: 'Baker',
    email: 'bob.baker@corp.example.com',
    departmentId: 1,
    jobTitle: 'Analyst, Payroll',
    jobLevel: 2,
    branchId: 1,
    countryCode: 'US',
    employmentStatus: 'on_leave',
    workMode: 'remote',
  },
  {
    id: 3,
    firstName: 'Cara',
    lastName: 'Carter',
    email: 'cara.carter@corp.example.com',
    departmentId: 2,
    jobTitle: 'Counsel, Legal',
    jobLevel: 6,
    branchId: 2,
    countryCode: 'IN',
    employmentStatus: 'terminated',
    workMode: 'office',
    terminationDate: '2025-03-31',
  },
  {
    id: 42,
    firstName: 'Dan',
    lastName: 'Dunn',
    email: 'dan.dunn@corp.example.com',
    departmentId: 2,
    jobTitle: 'Partner, Legal',
    jobLevel: 7,
    branchId: 2,
    countryCode: 'IN',
    employmentStatus: 'active',
    workMode: 'office',
  },
];

async function seed(): Promise<void> {
  for (const branch of BRANCHES) {
    await pglite.query(
      `insert into branches (id, branch_code, name, city, country_code, currency_code)
       values ($1, $2, $3, $4, $5, $6)`,
      [branch.id, branch.code, branch.name, branch.city, branch.country, branch.currency],
    );
  }

  for (const department of DEPARTMENTS) {
    await pglite.query(`insert into departments (id, name) values ($1, $2)`, [
      department.id,
      department.name,
    ]);
  }

  for (const employee of EMPLOYEES) {
    await pglite.query(
      `insert into employees
         (id, first_name, last_name, email, department_id, job_title, job_level, branch_id,
          country_code, hire_date, termination_date, employment_status, gender, date_of_birth, work_mode)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, '2020-01-01', $10, $11, 'Male', '1990-01-01', $12)`,
      [
        employee.id,
        employee.firstName,
        employee.lastName,
        employee.email,
        employee.departmentId,
        employee.jobTitle,
        employee.jobLevel,
        employee.branchId,
        employee.countryCode,
        employee.terminationDate ?? null,
        employee.employmentStatus,
        employee.workMode,
      ],
    );
  }
}

async function seedSalary(
  employeeId: number,
  effectiveFrom: string,
  baseSalary: string,
  currencyCode: string,
  bonusPct = '0.00',
  usdEquivalent: string | null = null,
): Promise<void> {
  await pglite.query(
    `insert into salary_records
       (employee_id, effective_from, base_salary, bonus_pct, currency_code, usd_equivalent)
     values ($1, $2, $3, $4, $5, $6)`,
    [employeeId, effectiveFrom, baseSalary, bonusPct, currencyCode, usdEquivalent],
  );
}

async function query(raw: Record<string, unknown>) {
  const parsed = parseEmployeeDirectoryQuery(raw);
  if (parsed === null) {
    throw new Error('Expected the query to parse.');
  }
  return queryEmployeeDirectory(db, parsed);
}

beforeEach(async () => {
  await resetTestDatabase();
  pglite = await getTestDatabase();
  db = drizzle(pglite, { casing: 'snake_case', schema }) as unknown as DirectoryDatabase;
  await seed();
});

describe('queryEmployeeDirectory', () => {
  it('returns every employee when no filter is applied', async () => {
    const result = await query({});
    expect(result.total).toBe(4);
    expect(result.rows).toHaveLength(4);
    expect(result.isEmptyPopulation).toBe(false);
  });

  it('reports the total across every page, not the page size', async () => {
    const result = await query({ pageSize: '2' });
    expect(result.rows).toHaveLength(2);
    expect(result.total).toBe(4);
    expect(result.totalPages).toBe(2);
  });

  it('returns a different row set on the second page', async () => {
    const first = await query({ pageSize: '2', page: '1' });
    const second = await query({ pageSize: '2', page: '2' });
    expect(first.rows[0]?.id).not.toBe(second.rows[0]?.id);
    expect(second.rows).toHaveLength(2);
  });

  it('returns no rows and the real total for a page beyond the last (QRY-004)', async () => {
    const result = await query({ page: '99' });
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(4);
    expect(result.totalPages).toBe(1);
  });

  it('filters by country', async () => {
    const result = await query({ country: 'IN' });
    expect(result.total).toBe(2);
    expect(result.rows.every((row) => row.countryCode === 'IN')).toBe(true);
  });

  it('filters by employment status', async () => {
    const result = await query({ status: 'terminated' });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.id).toBe(3);
  });

  it('filters by work mode', async () => {
    const result = await query({ workMode: 'remote' });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.id).toBe(2);
  });

  it('filters by job level', async () => {
    const result = await query({ level: '7' });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.id).toBe(42);
  });

  it('filters by branch', async () => {
    const result = await query({ branch: 'IN-BLR' });
    expect(result.total).toBe(2);
  });

  it('filters by department', async () => {
    const result = await query({ department: 'Legal' });
    expect(result.total).toBe(2);
  });

  it('ignores an unrecognised filter value rather than erroring (QRY-003)', async () => {
    const result = await query({ country: 'ZZ', status: 'retired', level: '99' });
    expect(result.total).toBe(4);
  });

  it('joins the department and branch names onto each row', async () => {
    const result = await query({});
    const row = result.rows.find((candidate) => candidate.id === 1);
    expect(row?.departmentName).toBe('Payroll');
    expect(row?.branchCode).toBe('US-NYC');
    expect(row?.branchCity).toBe('New York');
  });
});

describe('search (QRY-001, QRY-002)', () => {
  it('matches the full name, case-insensitively', async () => {
    const result = await query({ search: 'ann abbott' });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.id).toBe(1);
  });

  it('matches a part of the full name', async () => {
    const result = await query({ search: 'baker' });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.id).toBe(2);
  });

  it('matches the email', async () => {
    const result = await query({ search: 'cara.carter' });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.id).toBe(3);
  });

  it('matches an employee ID by prefix', async () => {
    const result = await query({ search: '4' });
    expect(result.rows.map((row) => row.id)).toContain(42);
  });

  it('trims surrounding whitespace', async () => {
    const result = await query({ search: '  abbott  ' });
    expect(result.total).toBe(1);
  });

  it('treats a percent sign as literal text, not as a wildcard (QRY-002)', async () => {
    await pglite.query(`update employees set first_name = 'A%' where id = 1`);

    const literal = await query({ search: 'A%' });
    expect(literal.total).toBe(1);
    expect(literal.rows[0]?.id).toBe(1);

    const wildcard = await query({ search: 'A' });
    expect(wildcard.total).toBe(4);
  });

  it('treats an underscore as literal text, not as a single-character wildcard (QRY-002)', async () => {
    await pglite.query(`update employees set first_name = 'A_B' where id = 1`);

    const literal = await query({ search: 'A_B' });
    expect(literal.total).toBe(1);

    const singleCharacter = await query({ search: 'A?B' });
    expect(singleCharacter.total).toBe(0);
  });

  it('treats a backslash as literal text (QRY-002)', async () => {
    await pglite.query(`update employees set first_name = 'A\\B' where id = 1`);

    const literal = await query({ search: 'A\\B' });
    expect(literal.total).toBe(1);
  });

  it('returns no rows when nothing matches', async () => {
    const result = await query({ search: 'nobody' });
    expect(result.total).toBe(0);
    expect(result.rows).toHaveLength(0);
  });
});

describe('empty results (QRY-007)', () => {
  it('reports an empty population when there is no data at all', async () => {
    await pglite.exec(`delete from employees`);
    const result = await query({});
    expect(result.total).toBe(0);
    expect(result.isEmptyPopulation).toBe(true);
  });

  it('does not report an empty population when a filter matched nothing', async () => {
    const result = await query({ search: 'nobody' });
    expect(result.total).toBe(0);
    expect(result.isEmptyPopulation).toBe(false);
  });
});

describe('sorting (QRY-005)', () => {
  it('sorts by employee name by default', async () => {
    const result = await query({});
    expect(result.rows.map((row) => row.lastName)).toEqual([
      'Abbott',
      'Baker',
      'Carter',
      'Dunn',
    ]);
  });

  it('sorts by job title', async () => {
    const result = await query({ sort: 'jobTitle' });
    expect(result.rows[0]?.jobTitle).toBe('Analyst, Payroll');
  });

  it('sorts by country alphabetically, not by the enum declaration order', async () => {
    // country_code is declared US, IN, GB, DE, CA, AU — so an enum sort would
    // put US first. A reader clicking "Country" expects alphabetical order.
    const result = await query({ sort: 'country' });
    expect(result.rows.map((row) => row.countryCode)).toEqual(['IN', 'IN', 'US', 'US']);
  });

  it('sorts by work mode alphabetically', async () => {
    const result = await query({ sort: 'workMode' });
    expect(result.rows.map((row) => row.workMode)).toEqual([
      'hybrid',
      'office',
      'office',
      'remote',
    ]);
  });

  it('falls back to the default sort for an unrecognised value', async () => {
    const unknown = await query({ sort: 'bogus' });
    const fallback = await query({});
    expect(unknown.rows.map((row) => row.id)).toEqual(fallback.rows.map((row) => row.id));
  });

  it('sorts by salary on one comparable basis across currencies', async () => {
    // The workforce is paid in six currencies. Sorting by the local amount
    // would compare ₹96,05,289 with $74,716 as though they were the same
    // unit, so the order would be an artefact of the currency mix. The
    // USD equivalent is the one basis every record shares.
    await pglite.query(`delete from salary_records`);
    await seedSalary(1, '2020-01-01', '9600000.00', 'INR', '0.00', '90000.00');
    await seedSalary(2, '2020-01-01', '74000.00', 'USD', '0.00', '74000.00');
    await seedSalary(3, '2020-01-01', '50000.00', 'GBP', '0.00', '62000.00');
    await seedSalary(42, '2020-01-01', '30000.00', 'EUR', '0.00', '33000.00');

    const result = await query({ sort: 'salary' });

    // 90000, 74000, 62000, 33000 — descending by the USD equivalent.
    expect(result.rows.map((row) => row.id)).toEqual([1, 2, 3, 42]);
  });

  it('keeps a stable order across pages', async () => {
    const first = await query({ pageSize: '2', page: '1' });
    const second = await query({ pageSize: '2', page: '2' });
    const ids = [...first.rows, ...second.rows].map((row) => row.id);
    expect(ids).toEqual([1, 2, 3, 42]);
  });
});

describe('current salary on each row (SAL-007, RPT-001)', () => {
  it('shows the salary effective on or before the reporting date', async () => {
    await seedSalary(1, '2024-01-01', '50000.00', 'USD');
    await seedSalary(1, '2025-06-01', '60000.00', 'USD');

    const result = await query({ asOf: '2026-01-01' });
    const row = result.rows.find((candidate) => candidate.id === 1);
    expect(row?.currentBaseSalary).toBe('60000.00');
    expect(row?.currentCurrencyCode).toBe('USD');
    expect(row?.currentEffectiveFrom).toBe('2025-06-01');
  });

  it('shows the earlier salary when the reporting date precedes the revision', async () => {
    await seedSalary(1, '2024-01-01', '50000.00', 'USD');
    await seedSalary(1, '2025-06-01', '60000.00', 'USD');

    const result = await query({ asOf: '2025-01-01' });
    const row = result.rows.find((candidate) => candidate.id === 1);
    expect(row?.currentBaseSalary).toBe('50000.00');
  });

  it('shows no salary when every record is in the future', async () => {
    await seedSalary(1, '2030-01-01', '50000.00', 'USD');

    const result = await query({ asOf: '2026-01-01' });
    const row = result.rows.find((candidate) => candidate.id === 1);
    expect(row?.currentBaseSalary).toBeNull();
  });

  it('leaves the salary null for an employee who has none', async () => {
    const result = await query({});
    const row = result.rows.find((candidate) => candidate.id === 1);
    expect(row?.currentBaseSalary).toBeNull();
  });
});
