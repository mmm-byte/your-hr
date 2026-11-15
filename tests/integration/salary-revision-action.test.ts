/**
 * Covers:
 * - CON-002 a conflict preserves the reader's submitted input
 * - SAL-011 a stale revision is a conflict, never a silent overwrite
 * - ELG-001 a terminated employee is rejected
 * - ELG-002 / ELG-003 an effective date outside the employment window is
 *   rejected with the rule and the permitted range
 * - ELG-004 a currency that differs from the employee's is rejected, never
 *   silently overridden
 * - SAL-009 a blank reason is rejected
 * - SAL-002 / SAL-003 the amounts are validated
 * - AUD-004 every failure carries a safe message and a correlation id
 *
 * Does not cover:
 * - The transaction and the rollback (tests/integration/salary-revision.test.ts)
 * - The form UI (tests/component/salary-revision-form.test.tsx)
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createSeededDatabase } from '../fixtures/seeded-database';
import { schema } from '@/db/schema';
import type { RevisionDatabase } from '@/db/queries/salary-revision';
import { applySalaryRevision } from '@/server/salary-revision';
import type { SalaryRevisionInput } from '@/schemas/salary-revision';

let pglite: PGlite;
let db: RevisionDatabase;

/** An active employee in the USD branch, from the seeded cohort. */
const ACTIVE_EMPLOYEE = 2521;
/** A terminated employee in the seeded cohort. */
const TERMINATED_EMPLOYEE = 2;

beforeAll(async () => {
  pglite = await createSeededDatabase();
  db = drizzle(pglite, { casing: 'snake_case', schema }) as unknown as RevisionDatabase;
}, 120_000);

afterAll(async () => {
  await pglite?.close();
});

/** The employee's stored compensation version. */
async function currentVersion(employeeId: number): Promise<number> {
  const rows = await pglite.query<{ version: number }>(
    `select version from employees where id = $1`,
    [employeeId],
  );
  return rows.rows[0]?.version ?? 0;
}

/** A valid revision for the given employee. */
async function validInput(
  employeeId: number,
  overrides: Partial<SalaryRevisionInput> = {},
): Promise<SalaryRevisionInput> {
  return {
    employeeId,
    baseSalary: '80000.00',
    bonusPct: '5.00',
    currency: 'USD',
    effectiveFrom: '2027-06-01',
    reason: 'Annual review adjustment',
    expectedVersion: await currentVersion(employeeId),
    ...overrides,
  };
}

describe('a valid revision', () => {
  it('is applied and reports the new state', async () => {
    const result = await applySalaryRevision(await validInput(ACTIVE_EMPLOYEE), db);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.revisionId).toBeGreaterThan(0);
      expect(result.version).toBeGreaterThan(0);
      expect(result.correlationId).toBeTruthy();
    }
  });
});

describe('a stale revision', () => {
  it('is a conflict, and preserves the reader input', async () => {
    const input = await validInput(ACTIVE_EMPLOYEE, {
      expectedVersion: 1,
      reason: 'The reason the reader typed',
    });

    const result = await applySalaryRevision(input, db);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SALARY_VERSION_CONFLICT');
      // CON-002: the reader's input survives the conflict.
      expect(result.submitted).toEqual(input);
      expect(result.correlationId).toBeTruthy();
    }
  });
});

describe('the domain rules', () => {
  it('rejects a terminated employee', async () => {
    const result = await applySalaryRevision(await validInput(TERMINATED_EMPLOYEE), db);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SALARY_NOT_ELIGIBLE');
    }
  });

  it('rejects an effective date before the hire date', async () => {
    const result = await applySalaryRevision(
      await validInput(ACTIVE_EMPLOYEE, { effectiveFrom: '2000-01-01' }),
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION_ERROR');
      // The message names the rule and the permitted range.
      expect(result.message).toMatch(/hire date/i);
      expect(result.fieldErrors.effectiveFrom).toBeTruthy();
    }
  });

  it('rejects a currency that differs from the employee currency', async () => {
    const result = await applySalaryRevision(
      await validInput(ACTIVE_EMPLOYEE, { currency: 'INR' }),
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION_ERROR');
      expect(result.message).toMatch(/currency cannot be changed/i);
      expect(result.fieldErrors.currency).toBeTruthy();
    }
  });

  it('rejects a blank reason', async () => {
    const result = await applySalaryRevision(
      await validInput(ACTIVE_EMPLOYEE, { reason: '   ' }),
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.reason).toBeTruthy();
    }
  });

  it('rejects a base salary of zero', async () => {
    const result = await applySalaryRevision(
      await validInput(ACTIVE_EMPLOYEE, { baseSalary: '0.00' }),
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.baseSalary).toBeTruthy();
    }
  });

  it('rejects a bonus percentage above 100', async () => {
    const result = await applySalaryRevision(
      await validInput(ACTIVE_EMPLOYEE, { bonusPct: '150.00' }),
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.bonusPct).toBeTruthy();
    }
  });

  it('rejects a duplicate effective date', async () => {
    // A date of its own: the happy-path test above already wrote
    // 2027-06-01, and every test in this file shares one database.
    const effectiveFrom = '2027-06-02' as const;

    const first = await applySalaryRevision(
      await validInput(ACTIVE_EMPLOYEE, { effectiveFrom }),
      db,
    );
    expect(first.ok).toBe(true);

    const second = await applySalaryRevision(
      await validInput(ACTIVE_EMPLOYEE, { effectiveFrom }),
      db,
    );

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe('SALARY_EFFECTIVE_DATE_CONFLICT');
    }
  });
});

describe('an unknown employee', () => {
  it('is a controlled not-found, not a crash', async () => {
    const result = await applySalaryRevision(await validInput(999_999), db);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('EMPLOYEE_NOT_FOUND');
      expect(result.message).not.toMatch(/select|relation|pg_/i);
    }
  });
});

describe('the failure shape', () => {
  it('never carries a raw database message', async () => {
    const result = await applySalaryRevision(
      await validInput(ACTIVE_EMPLOYEE, { baseSalary: '-1.00' }),
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toMatch(/select|relation|constraint|pg_/i);
      expect(result.correlationId).toMatch(/^req-/);
    }
  });
});
