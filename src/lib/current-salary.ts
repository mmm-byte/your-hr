/**
 * Current and scheduled salary selection (SAL-007, SAL-008, RPT-001, RPT-002).
 *
 * "Current salary" is the latest salary record effective **on or before** the
 * reporting date — not the row with the greatest ID, and not simply the latest
 * row. A record effective after the reporting date is *scheduled*: it exists
 * and is visible, but it is never counted as current compensation.
 *
 * This is the rule that makes effective-dated history useful rather than
 * decorative, so it lives in a pure function with no database access and is
 * tested directly.
 *
 * Called by: the employee profile, the directory query (which joins a current
 * salary onto every row), the compensation view, and the analytics aggregates.
 * Rules: SAL-007, SAL-008, ANA-006, RPT-001, RPT-002.
 * Tests: tests/unit/current-salary.test.ts
 */

import { compareDateOnly, isOnOrBefore, type DateOnly } from './date-only';

/**
 * The minimum shape this module needs from a salary record.
 *
 * Keeping it structural means the function works with a Drizzle row, a plain
 * object from a query projection, or a test fixture, without importing the
 * database layer.
 */
export interface SalaryRecordLike {
  readonly id: number;
  readonly employeeId: number;
  readonly effectiveFrom: DateOnly;
  readonly baseSalary: string;
  readonly bonusPct: string;
  readonly currency: string;
}

export interface SalarySelection {
  /** The salary effective on or before the reporting date, if any. */
  readonly current: SalaryRecordLike | null;
  /** The earliest salary record effective after the reporting date, if any. */
  readonly scheduled: SalaryRecordLike | null;
}

/**
 * Sort salary records by effective date, newest first.
 *
 * Ties are impossible in a valid dataset — the database enforces
 * `(employee_id, effective_from)` uniqueness (SAL-006) — but the tie-break on
 * `id` keeps the order total and deterministic regardless.
 */
export function sortByEffectiveDateDesc(
  records: readonly SalaryRecordLike[],
): SalaryRecordLike[] {
  return [...records].sort((a, b) => {
    const byDate = compareDateOnly(b.effectiveFrom, a.effectiveFrom);
    return byDate !== 0 ? byDate : b.id - a.id;
  });
}

/**
 * Select the current and scheduled salary for a reporting date.
 *
 * @param records all salary records for one employee
 * @param reportingDate the date as of which compensation is interpreted
 */
export function selectSalaryAsOf(
  records: readonly SalaryRecordLike[],
  reportingDate: DateOnly,
): SalarySelection {
  const ordered = sortByEffectiveDateDesc(records);

  // Records are newest-first, so the first one on or before the reporting date
  // is the latest such record — the current salary (SAL-007).
  const currentIndex = ordered.findIndex((record) =>
    isOnOrBefore(record.effectiveFrom, reportingDate),
  );

  const current = currentIndex === -1 ? null : (ordered[currentIndex] ?? null);

  // Anything before the current record is effective *later* than the reporting
  // date. The earliest of those is the next scheduled change (SAL-008).
  const future = ordered.slice(0, currentIndex === -1 ? ordered.length : currentIndex);
  const scheduled = future.length > 0 ? (future[future.length - 1] ?? null) : null;

  return { current, scheduled };
}

/**
 * True when a salary record is scheduled relative to the reporting date.
 */
export function isScheduled(record: SalaryRecordLike, reportingDate: DateOnly): boolean {
  return !isOnOrBefore(record.effectiveFrom, reportingDate);
}

/**
 * Label a salary record for display.
 *
 * Distinguishes current from scheduled so the UI can never present a future
 * revision as present compensation (SAL-008, RPT-002).
 */
export function describeSalaryTiming(
  record: SalaryRecordLike,
  reportingDate: DateOnly,
): 'current' | 'scheduled' {
  return isScheduled(record, reportingDate) ? 'scheduled' : 'current';
}
