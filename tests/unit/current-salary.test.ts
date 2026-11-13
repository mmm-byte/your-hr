/**
 * Covers:
 * - SAL-007 current salary is the latest record effective on or before the reporting date
 * - SAL-008 a future-effective record is scheduled, never current
 * - ANA-006 reporting-date queries use effective-dated state
 *
 * Does not cover:
 * - The database query that fetches these records (tests/integration/current-salary.integration.test.ts)
 */
import { describe, expect, it } from 'vitest';
import {
  describeSalaryTiming,
  isScheduled,
  selectSalaryAsOf,
  sortByEffectiveDateDesc,
  type SalaryRecordLike,
} from '@/lib/current-salary';

function salary(
  id: number,
  effectiveFrom: string,
  baseSalary = '50000.00',
): SalaryRecordLike {
  return {
    id,
    employeeId: 1,
    effectiveFrom,
    baseSalary,
    bonusPct: '5.00',
    currency: 'USD',
  };
}

describe('selectSalaryAsOf', () => {
  const records = [
    salary(3, '2025-03-01', '30000.00'),
    salary(1, '2024-01-01', '10000.00'),
    salary(2, '2024-06-01', '20000.00'),
  ];

  it('selects the latest record effective on or before the reporting date', () => {
    const { current } = selectSalaryAsOf(records, '2025-01-01');
    expect(current?.id).toBe(2);
    expect(current?.baseSalary).toBe('20000.00');
  });

  it('selects the record effective exactly on the reporting date', () => {
    const { current } = selectSalaryAsOf(records, '2025-03-01');
    expect(current?.id).toBe(3);
  });

  it('does not treat a future record as current', () => {
    const { current } = selectSalaryAsOf(records, '2024-03-01');
    expect(current?.id).toBe(1);
  });

  it('returns no current salary when every record is in the future', () => {
    const { current } = selectSalaryAsOf([salary(1, '2030-01-01')], '2026-01-01');
    expect(current).toBeNull();
  });

  it('returns no current salary for an employee with no records', () => {
    const { current, scheduled } = selectSalaryAsOf([], '2026-01-01');
    expect(current).toBeNull();
    expect(scheduled).toBeNull();
  });

  it('returns the earliest future record as the scheduled revision', () => {
    const { scheduled } = selectSalaryAsOf(
      [salary(2, '2027-06-01'), salary(1, '2026-03-01'), salary(3, '2028-01-01')],
      '2026-01-01',
    );
    expect(scheduled?.effectiveFrom).toBe('2026-03-01');
  });

  it('returns no scheduled record when nothing is in the future', () => {
    const { scheduled } = selectSalaryAsOf(records, '2026-01-01');
    expect(scheduled).toBeNull();
  });

  it('does not use the greatest id as the current record', () => {
    // The row with the greatest ID is not necessarily the effective one.
    const shuffled = [salary(99, '2024-01-01', '10000.00'), salary(1, '2025-01-01', '20000.00')];
    const { current } = selectSalaryAsOf(shuffled, '2026-01-01');
    expect(current?.id).toBe(1);
    expect(current?.baseSalary).toBe('20000.00');
  });
});

describe('sortByEffectiveDateDesc', () => {
  it('orders newest first', () => {
    const ordered = sortByEffectiveDateDesc([
      salary(1, '2024-01-01'),
      salary(3, '2026-01-01'),
      salary(2, '2025-01-01'),
    ]);
    expect(ordered.map((record) => record.effectiveFrom)).toEqual([
      '2026-01-01',
      '2025-01-01',
      '2024-01-01',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [salary(1, '2024-01-01'), salary(2, '2026-01-01')];
    sortByEffectiveDateDesc(input);
    expect(input[0]?.effectiveFrom).toBe('2024-01-01');
  });
});

describe('isScheduled', () => {
  it('marks a future record as scheduled', () => {
    expect(isScheduled(salary(1, '2027-01-01'), '2026-01-01')).toBe(true);
  });

  it('marks a past or same-day record as current', () => {
    expect(isScheduled(salary(1, '2025-01-01'), '2026-01-01')).toBe(false);
    expect(isScheduled(salary(1, '2026-01-01'), '2026-01-01')).toBe(false);
  });
});

describe('describeSalaryTiming', () => {
  it('labels a future record as scheduled', () => {
    expect(describeSalaryTiming(salary(1, '2027-01-01'), '2026-01-01')).toBe('scheduled');
  });

  it('labels an effective record as current', () => {
    expect(describeSalaryTiming(salary(1, '2026-01-01'), '2026-01-01')).toBe('current');
  });
});
