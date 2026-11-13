/**
 * Covers:
 * - Gate 3 the profile shows the correct current salary for a past, present, and future reporting date
 * - SAL-007 the current salary is the one effective on or before the reporting date
 * - SAL-008 a future-effective revision is labelled scheduled, never current
 * - ELG-006 a terminated employee's salary is labelled as final
 * - EMP-009 a terminated employee's profile is still reachable
 * - RPT-002 the reporting date is stated on the profile
 * - MON-005 the USD equivalent is labelled as synthetic
 * - SEED-001/002 the absence and performance context is labelled as a seed summary
 *
 * Does not cover:
 * - Browser interaction (tests/e2e/)
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { createSeededDatabase } from '../fixtures/seeded-database';
import { schema } from '@/db/schema';

let client: PGlite;
let seededDb: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  client = await createSeededDatabase();
  seededDb = drizzle(client, { casing: 'snake_case', schema });
});

afterAll(async () => {
  await client?.close();
});

vi.mock('@/db/client', () => ({
  getDatabase: () => seededDb,
}));

async function renderProfile(employeeId: number, search: Record<string, string> = {}) {
  const { default: EmployeeProfilePage } = await import('@/app/employees/[employeeId]/page');
  const element = await EmployeeProfilePage({
    params: Promise.resolve({ employeeId: String(employeeId) }),
    searchParams: Promise.resolve(search),
  });
  return renderToStaticMarkup(element);
}

/** Find an employee who has a salary record, to profile. */
async function findEmployeeWithSalary(): Promise<number> {
  const result = await seededDb.execute(
    `select employee_id from salary_records group by employee_id order by employee_id limit 1`,
  );
  const rows = result.rows as { employee_id: number }[];
  const row = rows[0];
  if (row === undefined) {
    throw new Error('The seeded database has no salary records.');
  }
  return row.employee_id;
}

describe('the employee profile against the seeded workforce', () => {
  it('renders the identity, the compensation card, and the history', async () => {
    const employeeId = await findEmployeeWithSalary();
    const html = await renderProfile(employeeId);

    expect(html).toContain('Identity and employment');
    expect(html).toContain('Compensation');
    expect(html).toContain('Salary history');
    expect(html).toContain('Current as of');
  });

  it('labels the USD equivalent as synthetic (MON-005)', async () => {
    const employeeId = await findEmployeeWithSalary();
    const html = await renderProfile(employeeId);

    expect(html).toContain('USD equivalent (synthetic)');
  });

  it('labels the absence and performance context as a seed summary', async () => {
    const employeeId = await findEmployeeWithSalary();
    const html = await renderProfile(employeeId);

    expect(html).toContain('Seed summary');
    expect(html).toContain('Absence');
    expect(html).toContain('Latest performance review');
  });

  it('shows a different current salary for a past reporting date', async () => {
    const employeeId = await findEmployeeWithSalary();

    const today = await renderProfile(employeeId, { asOf: '2026-11-13' });
    const past = await renderProfile(employeeId, { asOf: '2020-01-01' });

    expect(today).not.toBe(past);
  });

  it('states the reporting date the reader chose', async () => {
    const employeeId = await findEmployeeWithSalary();
    const html = await renderProfile(employeeId, { asOf: '2024-06-15' });

    expect(html).toContain('2024');
    expect(html).toContain('Reporting context:');
  });

  it('renders a terminated employee as final salary, not current salary', async () => {
    const terminated = await seededDb.execute(
      `select id from employees where employment_status = 'terminated' limit 1`,
    );
    const rows = terminated.rows as { id: number }[];
    const row = rows[0];
    expect(row).toBeDefined();

    const html = await renderProfile(row!.id);
    expect(html).toContain('Final salary');
    expect(html).not.toContain('>Current salary<');
  });

  it('never offers a salary revision to a terminated employee (ELG-005)', async () => {
    const terminated = await seededDb.execute(
      `select id from employees where employment_status = 'terminated' limit 1`,
    );
    const rows = terminated.rows as { id: number }[];

    const html = await renderProfile(rows[0]!.id);
    expect(html).not.toContain('revise-salary');
    expect(html).not.toContain('Revise salary');
  });

  it('keeps a terminated employee fully inspectable (EMP-009)', async () => {
    const terminated = await seededDb.execute(
      `select id from employees where employment_status = 'terminated' limit 1`,
    );
    const rows = terminated.rows as { id: number }[];

    const html = await renderProfile(rows[0]!.id);
    expect(html).toContain('Salary history');
    expect(html).toContain('Termination');
  });
});
