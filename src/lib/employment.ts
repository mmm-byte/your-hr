/**
 * Employment invariants (EMP-003…EMP-006, EMP-009, RPT-004).
 *
 * Pure rules about an employee's employment timeline. They run in two places:
 * during seed verification, and whenever the application reads an employee's
 * employment context — so a data problem surfaces as a clear rule failure
 * rather than as a confusing screen.
 *
 * Called by: the seed verifier, the employee profile, and the revision
 * eligibility check.
 * Rules: EMP-003, EMP-004, EMP-005, EMP-006, EMP-009.
 * Tests: tests/unit/employment.test.ts
 */

import { compareDateOnly, daysBetween, type DateOnly } from './date-only';
import type { EmploymentStatus } from './domain-values';

export type { EmploymentStatus };

export interface EmploymentFacts {
  readonly hireDate: DateOnly;
  readonly terminationDate: DateOnly | null;
  readonly employmentStatus: EmploymentStatus;
}

export type EmploymentViolationCode =
  | 'HIRE_DATE_MISSING'
  | 'TERMINATION_BEFORE_HIRE'
  | 'ACTIVE_WITH_TERMINATION_DATE'
  | 'ON_LEAVE_WITH_TERMINATION_DATE'
  | 'TERMINATED_WITHOUT_TERMINATION_DATE';

/**
 * Check the employment invariants for one employee.
 *
 * Returns every violation rather than the first, so a seed verifier can report
 * all the problems in one pass.
 */
export function validateEmployment(facts: EmploymentFacts): EmploymentViolationCode[] {
  const violations: EmploymentViolationCode[] = [];

  if (!facts.hireDate) {
    violations.push('HIRE_DATE_MISSING');
  }

  if (facts.terminationDate !== null && facts.hireDate) {
    if (compareDateOnly(facts.terminationDate, facts.hireDate) < 0) {
      violations.push('TERMINATION_BEFORE_HIRE');
    }
  }

  if (facts.employmentStatus === 'active' && facts.terminationDate !== null) {
    violations.push('ACTIVE_WITH_TERMINATION_DATE');
  }

  if (facts.employmentStatus === 'on_leave' && facts.terminationDate !== null) {
    violations.push('ON_LEAVE_WITH_TERMINATION_DATE');
  }

  if (facts.employmentStatus === 'terminated' && facts.terminationDate === null) {
    violations.push('TERMINATED_WITHOUT_TERMINATION_DATE');
  }

  return violations;
}

/** True when the employee is currently employed (active or on leave). */
export function isCurrentlyEmployed(facts: EmploymentFacts): boolean {
  return facts.employmentStatus === 'active' || facts.employmentStatus === 'on_leave';
}

/**
 * Years of service, rounded to two decimals.
 *
 * Calculated in whole days and then converted, so it does not depend on
 * calendar-year arithmetic (which is wrong for partial years).
 */
export function yearsOfService(
  hireDate: DateOnly,
  asOf: DateOnly,
  terminationDate: DateOnly | null = null,
): number {
  const end = terminationDate !== null && compareDateOnly(terminationDate, asOf) < 0 ? terminationDate : asOf;
  const days = daysBetween(hireDate, end);
  return Math.round((days / 365.25) * 100) / 100;
}

/**
 * The label used for an employee's salary card.
 *
 * A terminated employee has a *final* salary, not a current one — the
 * difference matters when reading a compensation record (ELG-006).
 */
export function salaryCardLabel(facts: EmploymentFacts): string {
  return facts.employmentStatus === 'terminated' ? 'Final salary' : 'Current salary';
}
