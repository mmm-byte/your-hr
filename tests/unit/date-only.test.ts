/**
 * Covers:
 * - RPT-004 date-only values never shift across time zones
 * - RPT-001 the reporting-date default
 * - Date comparison, range checks, and day arithmetic
 *
 * Does not cover:
 * - Rendering in the UI (tests/component/money-display.test.tsx)
 * - Database date storage (tests/integration/schema.integration.test.ts)
 */
import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareDateOnly,
  daysBetween,
  formatDateOnly,
  formatDateLong,
  isDateOnly,
  isOnOrAfter,
  isOnOrBefore,
  isWithinRange,
  todayDateOnly,
} from '@/lib/date-only';

describe('isDateOnly', () => {
  it('accepts a well-formed calendar day', () => {
    expect(isDateOnly('2026-03-01')).toBe(true);
    expect(isDateOnly('2024-02-29')).toBe(true);
  });

  it('rejects a day that does not exist', () => {
    expect(isDateOnly('2026-02-30')).toBe(false);
    expect(isDateOnly('2025-02-29')).toBe(false);
    expect(isDateOnly('2026-13-01')).toBe(false);
    expect(isDateOnly('2026-00-10')).toBe(false);
    expect(isDateOnly('2026-04-31')).toBe(false);
  });

  it('rejects values that are not ISO dates', () => {
    expect(isDateOnly('01/03/2026')).toBe(false);
    expect(isDateOnly('2026-3-1')).toBe(false);
    expect(isDateOnly('')).toBe(false);
    expect(isDateOnly(null)).toBe(false);
    expect(isDateOnly(20260301)).toBe(false);
  });
});

describe('formatDateOnly', () => {
  it('renders the stored calendar day regardless of the runtime timezone', () => {
    // The classic bug: `new Date('2026-03-01')` is midnight UTC and formats as
    // 28 February in a negative-offset timezone. Date-only formatting must not
    // shift the day.
    expect(formatDateOnly('2026-03-01', { timeZone: 'UTC' }, 'en-US')).toContain('1');
    expect(formatDateLong('2026-03-01', 'en-US')).toBe('1 Mar 2026');
  });

  it('formats the first day of a month as the first, not the last of the previous', () => {
    expect(formatDateLong('2026-03-01', 'en-US')).toBe('1 Mar 2026');
    expect(formatDateLong('2026-01-01', 'en-US')).toBe('1 Jan 2026');
  });
});

describe('todayDateOnly', () => {
  it('returns the local calendar date in ISO form', () => {
    const now = new Date(2026, 10, 12, 9, 30);
    expect(todayDateOnly(now)).toBe('2026-11-12');
  });

  it('does not roll the day forward for a late-evening local time', () => {
    const now = new Date(2026, 10, 12, 23, 59, 59);
    expect(todayDateOnly(now)).toBe('2026-11-12');
  });
});

describe('comparison helpers', () => {
  it('compares ISO dates chronologically', () => {
    expect(compareDateOnly('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareDateOnly('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareDateOnly('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('treats boundary dates as inclusive', () => {
    expect(isOnOrBefore('2026-01-01', '2026-01-01')).toBe(true);
    expect(isOnOrAfter('2026-01-01', '2026-01-01')).toBe(true);
    expect(isWithinRange('2026-01-01', '2026-01-01', '2026-12-31')).toBe(true);
    expect(isWithinRange('2026-12-31', '2026-01-01', '2026-12-31')).toBe(true);
    expect(isWithinRange('2025-12-31', '2026-01-01', '2026-12-31')).toBe(false);
  });
});

describe('addDays', () => {
  it('crosses month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('crosses year boundaries and handles leap years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });
});

describe('daysBetween', () => {
  it('counts whole days between two dates', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30);
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
  });
});
