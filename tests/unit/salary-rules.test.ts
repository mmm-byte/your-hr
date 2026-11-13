/**
 * Covers:
 * - SAL-002 positive base salary
 * - SAL-003 bonus percentage within 0-100
 * - SAL-004 effective date not before hire
 * - SAL-006 duplicate effective date conflict
 * - SAL-009 a reason is required
 * - SAL-012 salary after termination is rejected
 * - ELG-001 terminated employees are not revisable
 * - ELG-002 effective date must precede termination
 * - ELG-004 currency is fixed by the employee's policy
 * - CON-001 a stale version is a conflict
 *
 * Does not cover:
 * - The transaction that persists a valid revision (tests/integration/salary-revision.integration.test.ts)
 */
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@/lib/error-codes';
import {
  isEligibleForRevision,
  isStaleVersion,
  isUnchangedRevision,
  validateSalaryRevision,
  type EmploymentContext,
  type SalaryRevisionInput,
} from '@/lib/salary-rules';

const employment: EmploymentContext = {
  employeeId: 1,
  employmentStatus: 'active',
  hireDate: '2020-01-15',
  terminationDate: null,
  currency: 'USD',
  version: 7,
};

function revision(overrides: Partial<SalaryRevisionInput> = {}): SalaryRevisionInput {
  return {
    baseSalary: '55000.00',
    bonusPct: '8.5',
    currency: 'USD',
    effectiveFrom: '2026-03-01',
    reason: 'Annual review adjustment',
    ...overrides,
  };
}

function codesFor(
  input: SalaryRevisionInput,
  context: EmploymentContext = employment,
  existingDates: string[] = [],
): string[] {
  return validateSalaryRevision(input, context, existingDates).map((violation) => violation.code);
}

describe('validateSalaryRevision', () => {
  it('accepts a valid revision', () => {
    expect(validateSalaryRevision(revision(), employment, [])).toEqual([]);
  });

  it('rejects a zero or negative base salary', () => {
    expect(codesFor(revision({ baseSalary: '0.00' }))).toContain(ERROR_CODES.VALIDATION_ERROR);
    expect(codesFor(revision({ baseSalary: '-100.00' }))).toContain(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects a malformed base salary', () => {
    expect(codesFor(revision({ baseSalary: 'abc' }))).toContain(ERROR_CODES.VALIDATION_ERROR);
  });

  it('accepts bonus percentages at both boundaries', () => {
    expect(codesFor(revision({ bonusPct: '0' }))).not.toContain(ERROR_CODES.VALIDATION_ERROR);
    expect(codesFor(revision({ bonusPct: '100' }))).not.toContain(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects a bonus percentage outside 0-100', () => {
    expect(codesFor(revision({ bonusPct: '-1' }))).toContain(ERROR_CODES.VALIDATION_ERROR);
    expect(codesFor(revision({ bonusPct: '101' }))).toContain(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects an effective date before the hire date', () => {
    expect(codesFor(revision({ effectiveFrom: '2019-12-31' }))).toContain(
      ERROR_CODES.VALIDATION_ERROR,
    );
  });

  it('accepts an effective date equal to the hire date', () => {
    expect(codesFor(revision({ effectiveFrom: '2020-01-15' }))).not.toContain(
      ERROR_CODES.VALIDATION_ERROR,
    );
  });

  it('rejects a currency different from the employee policy', () => {
    expect(codesFor(revision({ currency: 'EUR' }))).toContain(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects a blank reason', () => {
    expect(codesFor(revision({ reason: '   ' }))).toContain(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects an over-long reason', () => {
    expect(codesFor(revision({ reason: 'x'.repeat(501) }))).toContain(ERROR_CODES.VALIDATION_ERROR);
  });

  it('reports a duplicate effective date as a conflict, not a validation error', () => {
    const codes = codesFor(revision({ effectiveFrom: '2026-03-01' }), employment, ['2026-03-01']);
    expect(codes).toContain(ERROR_CODES.SALARY_EFFECTIVE_DATE_CONFLICT);
    expect(codes).not.toContain(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects a revision for a terminated employee', () => {
    const terminated: EmploymentContext = {
      ...employment,
      employmentStatus: 'terminated',
      terminationDate: '2024-06-30',
    };
    expect(codesFor(revision(), terminated)).toContain(ERROR_CODES.SALARY_NOT_ELIGIBLE);
  });

  it('rejects an effective date on or after the termination date', () => {
    const terminating: EmploymentContext = {
      ...employment,
      employmentStatus: 'terminated',
      terminationDate: '2024-06-30',
    };
    // The date check is independent of the eligibility check, so a terminated
    // employee with an early date still surfaces the date violation.
    const violations = validateSalaryRevision(
      revision({ effectiveFrom: '2024-07-01' }),
      terminating,
      [],
    );
    expect(violations.some((violation) => violation.field === 'effectiveFrom')).toBe(true);
  });

  it('collects every violation rather than stopping at the first', () => {
    const codes = codesFor(revision({ baseSalary: '0.00', bonusPct: '500', reason: '' }));
    expect(codes.filter((code) => code === ERROR_CODES.VALIDATION_ERROR).length).toBeGreaterThan(1);
  });
});

describe('isEligibleForRevision', () => {
  it('allows active and on-leave employees', () => {
    expect(isEligibleForRevision('active')).toBe(true);
    expect(isEligibleForRevision('on_leave')).toBe(true);
  });

  it('does not allow terminated employees', () => {
    expect(isEligibleForRevision('terminated')).toBe(false);
  });
});

describe('isStaleVersion', () => {
  it('detects a version the user did not see', () => {
    expect(isStaleVersion(6, 7)).toBe(true);
  });

  it('accepts the version the user saw', () => {
    expect(isStaleVersion(7, 7)).toBe(false);
  });
});

describe('isUnchangedRevision', () => {
  it('detects a revision that changes nothing', () => {
    expect(
      isUnchangedRevision(
        revision({ baseSalary: '50000.00', bonusPct: '5.00' }),
        { baseSalary: '50000.00', bonusPct: '5.00' },
      ),
    ).toBe(true);
  });

  it('treats a first record as a change', () => {
    expect(isUnchangedRevision(revision(), null)).toBe(false);
  });
});
