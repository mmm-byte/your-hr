/**
 * Salary revision rules (SAL-002…009, SAL-012, ELG-001…ELG-005, CON-001).
 *
 * Pure validation and eligibility. No database access — the caller supplies the
 * employee's employment context and the existing salary records, and this
 * module decides whether the revision is allowed and why not.
 *
 * Every rejection carries a **stable error code** from D-017 and a message that
 * states the rule in plain language. The UI maps the code to a recovery action;
 * it never parses the message.
 *
 * Called by: the salary revision server action, and the revision form for
 * pre-submit guidance.
 * Rules: SAL-002, SAL-003, SAL-004, SAL-005, SAL-006, SAL-009, SAL-012,
 *        ELG-001, ELG-002, ELG-003, ELG-004, CON-001.
 * Tests: tests/unit/salary-rules.test.ts
 */

import { compareDateOnly, isOnOrAfter, type DateOnly } from './date-only';
import { compareMoney, toMinorUnits } from './money';
import { ERROR_CODES, type ErrorCode } from './error-codes';
import type { EmploymentStatus } from './domain-values';

export type { EmploymentStatus };

/** The employment facts a revision decision depends on. */
export interface EmploymentContext {
  readonly employeeId: number;
  readonly employmentStatus: EmploymentStatus;
  readonly hireDate: DateOnly;
  readonly terminationDate: DateOnly | null;
  /** Currency fixed by the employee's modelled country/branch policy. */
  readonly currency: string;
  /** The version the user was shown. */
  readonly version: number;
}

/** The proposed revision, as submitted. */
export interface SalaryRevisionInput {
  readonly baseSalary: string;
  readonly bonusPct: string;
  readonly currency: string;
  readonly effectiveFrom: DateOnly;
  readonly reason: string;
}

export interface RuleViolation {
  readonly code: ErrorCode;
  readonly message: string;
  /** The form field the violation belongs to, when it has one. */
  readonly field: string | null;
}

/** Minimum and maximum bonus percentage (SAL-003). */
export const MIN_BONUS_PCT = 0;
export const MAX_BONUS_PCT = 100;

/**
 * The bonus percentage expressed in **hundredths of a percent**.
 *
 * A bonus percentage is a decimal value with at most two fraction digits, so it
 * is compared as an integer rather than a JavaScript `number`. A float
 * comparison would put a boundary value at risk — and a boundary that is
 * accepted sometimes and rejected other times is worse than an outright
 * rejection, because the user cannot predict it (SAL-003, MON-002).
 */
const BONUS_PCT_SCALE = 100n;
const MIN_BONUS_PCT_UNITS = BigInt(MIN_BONUS_PCT) * BONUS_PCT_SCALE;
const MAX_BONUS_PCT_UNITS = BigInt(MAX_BONUS_PCT) * BONUS_PCT_SCALE;

/** The longest reason the application will store. */
export const MAX_REASON_LENGTH = 500;

/**
 * Whether a revision is permitted for this employment status.
 *
 * `on_leave` employees are still employed and can be revised. `terminated`
 * employees are not (ELG-001).
 */
export function isEligibleForRevision(status: EmploymentStatus): boolean {
  return status === 'active' || status === 'on_leave';
}

/**
 * Validate a proposed salary revision.
 *
 * Returns every violation found rather than stopping at the first, so the form
 * can highlight all the problems at once. An empty array means the revision is
 * valid.
 */
export function validateSalaryRevision(
  input: SalaryRevisionInput,
  employment: EmploymentContext,
  existingEffectiveDates: readonly DateOnly[],
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  if (!isEligibleForRevision(employment.employmentStatus)) {
    violations.push({
      code: ERROR_CODES.SALARY_NOT_ELIGIBLE,
      message:
        employment.employmentStatus === 'terminated'
          ? 'This employee has been terminated, so their salary history is closed.'
          : 'This employee is not eligible for a salary revision.',
      field: null,
    });
  }

  const salaryUnits = safeMinorUnits(input.baseSalary);
  if (salaryUnits === null) {
    violations.push({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Enter the base salary as a positive amount, for example 54206.05.',
      field: 'baseSalary',
    });
  } else if (salaryUnits <= 0n) {
    violations.push({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'The base salary must be greater than zero.',
      field: 'baseSalary',
    });
  }

  const bonusUnits = safeBonusUnits(input.bonusPct);
  if (
    bonusUnits === null ||
    bonusUnits < MIN_BONUS_PCT_UNITS ||
    bonusUnits > MAX_BONUS_PCT_UNITS
  ) {
    violations.push({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: `The bonus percentage must be between ${MIN_BONUS_PCT} and ${MAX_BONUS_PCT}.`,
      field: 'bonusPct',
    });
  }

  if (input.currency !== employment.currency) {
    violations.push({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: `The currency cannot be changed. This employee's salary is in ${employment.currency}.`,
      field: 'currency',
    });
  }

  if (!isOnOrAfter(input.effectiveFrom, employment.hireDate)) {
    violations.push({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: `The effective date must be on or after the hire date (${employment.hireDate}).`,
      field: 'effectiveFrom',
    });
  }

  if (
    employment.terminationDate !== null &&
    isOnOrAfter(input.effectiveFrom, employment.terminationDate)
  ) {
    violations.push({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: `The effective date must be before the termination date (${employment.terminationDate}).`,
      field: 'effectiveFrom',
    });
  }

  if (existingEffectiveDates.some((date) => date === input.effectiveFrom)) {
    violations.push({
      code: ERROR_CODES.SALARY_EFFECTIVE_DATE_CONFLICT,
      message: 'A salary revision already exists for that effective date.',
      field: 'effectiveFrom',
    });
  }

  if (input.reason.trim().length === 0) {
    violations.push({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'A reason is required so the change can be explained later.',
      field: 'reason',
    });
  } else if (input.reason.length > MAX_REASON_LENGTH) {
    violations.push({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: `The reason must be ${MAX_REASON_LENGTH} characters or fewer.`,
      field: 'reason',
    });
  }

  return violations;
}

/**
 * Decide whether a write is a conflict because the employee's compensation
 * changed after the user loaded the form (CON-001, SAL-011).
 */
export function isStaleVersion(
  submittedVersion: number,
  currentVersion: number,
): boolean {
  return submittedVersion !== currentVersion;
}

/**
 * Whether a revision would change the employee's pay at all.
 *
 * A revision that changes nothing still creates a historical record, which
 * permanently changes the record set. The caller may warn, but the write is
 * still valid — the reason field explains it.
 *
 * A malformed amount is treated as "changed" rather than throwing. The
 * validation rules already reject a malformed amount, and this function is
 * often called to *build* the message that explains the rejection — it must
 * not be the thing that crashes.
 */
export function isUnchangedRevision(
  input: SalaryRevisionInput,
  current: { baseSalary: string; bonusPct: string } | null,
): boolean {
  if (current === null) {
    return false;
  }
  const baseSalarySame = safeCompare(input.baseSalary, current.baseSalary);
  const bonusSame = safeCompare(input.bonusPct, current.bonusPct);
  return baseSalarySame && bonusSame;
}

/** Compare two amounts, treating an unparseable value as "not equal". */
function safeCompare(a: string, b: string): boolean {
  try {
    return compareMoney(a, b) === 0;
  } catch {
    return false;
  }
}

/**
 * Order effective dates chronologically. Used to show the salary history in a
 * stable, understandable order (SAL-007).
 */
export function sortEffectiveDates(dates: readonly DateOnly[]): DateOnly[] {
  return [...dates].sort(compareDateOnly);
}

function safeMinorUnits(value: string): bigint | null {
  try {
    return toMinorUnits(value);
  } catch {
    return null;
  }
}

/**
 * Parse a bonus percentage into hundredths of a percent, exactly.
 *
 * The percentage is scaled by 100 and compared as an integer, so `100` is
 * exactly the maximum and `12.5` is exactly twelve and a half percent. A
 * value with more than two fraction digits is rejected rather than rounded —
 * the stored column is `numeric(5,2)` and cannot hold the extra precision.
 */
function safeBonusUnits(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, whole, fraction = ''] = match;
  const padded = fraction.padEnd(2, '0');
  return BigInt(whole as string) * BONUS_PCT_SCALE + BigInt(padded);
}
