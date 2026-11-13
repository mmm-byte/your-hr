/**
 * Covers:
 * - ANA-003 median with correct even/odd handling
 * - ANA-004 an empty result set is empty, not a fabricated zero
 * - ANA-005 currency-sensitive metrics carry their currency
 * - RPT-006 display rounding does not corrupt the source value
 * - RPT-007 a displayed total covers a single currency
 *
 * Does not cover:
 * - The analytics page and its charts (Phase 5 UI)
 * - Database-side aggregation (Phase 5 queries)
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateByCurrency,
  averageMoney,
  countBy,
  headcountByStatus,
  medianMoney,
} from '@/lib/analytics';
import { groupByCurrency, totalSameCurrency } from '@/lib/money';

describe('medianMoney', () => {
  it('returns null for an empty set rather than zero', () => {
    expect(medianMoney([])).toBeNull();
  });

  it('returns the middle value for an odd-length set', () => {
    expect(medianMoney(['10.00', '20.00', '30.00'])).toBe('20.00');
  });

  it('averages the two middle values for an even-length set', () => {
    expect(medianMoney(['10.00', '20.00', '30.00', '40.00'])).toBe('25.00');
  });

  it('rounds a half-cent median to the nearest cent', () => {
    // 0.01 and 0.02 average to 0.015, which must become 0.02, not 0.01.
    expect(medianMoney(['0.01', '0.02'])).toBe('0.02');
  });

  it('is unaffected by the input order', () => {
    expect(medianMoney(['40.00', '10.00', '30.00', '20.00'])).toBe('25.00');
  });

  it('keeps the median exact where floating point would drift', () => {
    const amounts = ['0.10', '0.20'];
    expect(medianMoney(amounts)).toBe('0.15');
  });
});

describe('averageMoney', () => {
  it('returns null for an empty set', () => {
    expect(averageMoney([])).toBeNull();
  });

  it('divides exactly where floating point drifts', () => {
    expect(averageMoney(['0.10', '0.20'])).toBe('0.15');
    expect(averageMoney(['10.00', '20.00', '30.00'])).toBe('20.00');
  });

  it('stays exact across many values', () => {
    const amounts = Array.from({ length: 10_000 }, () => '0.01');
    expect(averageMoney(amounts)).toBe('0.01');
  });

  it('rounds a repeating average to the nearest cent', () => {
    // 10 / 3 = 3.333..., which must land on 3.33 rather than 3.34 or 3.33.33.
    expect(averageMoney(['10.00', '0.00', '0.00'])).toBe('3.33');
  });
});

describe('aggregateByCurrency', () => {
  it('produces an empty aggregate for no data, not a zero aggregate', () => {
    const aggregate = aggregateByCurrency('USD', []);
    expect(aggregate.count).toBe(0);
    expect(aggregate.median).toBeNull();
    expect(aggregate.average).toBeNull();
    expect(aggregate.minimum).toBeNull();
    expect(aggregate.maximum).toBeNull();
  });

  it('summarises a currency group', () => {
    const aggregate = aggregateByCurrency('EUR', ['100.00', '200.00', '300.00']);
    expect(aggregate.count).toBe(3);
    expect(aggregate.median).toBe('200.00');
    expect(aggregate.average).toBe('200.00');
    expect(aggregate.minimum).toBe('100.00');
    expect(aggregate.maximum).toBe('300.00');
  });

  it('carries the currency on the aggregate', () => {
    expect(aggregateByCurrency('GBP', ['10.00']).currency).toBe('GBP');
  });
});

describe('countBy', () => {
  it('counts the rows in each group', () => {
    const groups = countBy(
      ['Engineering', 'Engineering', 'Sales'],
      (title) => title,
    );
    expect(groups).toEqual([
      { label: 'Engineering', count: 2 },
      { label: 'Sales', count: 1 },
    ]);
  });

  it('sorts by count descending, then label ascending, so the order is stable', () => {
    const groups = countBy(['b', 'a', 'c'], (value) => value);
    expect(groups.map((group) => group.label)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty list for no rows', () => {
    expect(countBy([], (value: string) => value)).toEqual([]);
  });
});

describe('headcountByStatus', () => {
  const rows = [
    { employmentStatus: 'active' },
    { employmentStatus: 'active' },
    { employmentStatus: 'on_leave' },
    { employmentStatus: 'terminated' },
  ];

  it('counts the current workforce only, by default', () => {
    const groups = headcountByStatus(rows);
    expect(groups).toEqual([
      { label: 'active', count: 2 },
      { label: 'on_leave', count: 1 },
    ]);
  });

  it('includes terminated employees only when asked', () => {
    const groups = headcountByStatus(rows, { includeTerminated: true });
    expect(groups).toContainEqual({ label: 'terminated', count: 1 });
  });

  it('returns an empty list when there is no workforce', () => {
    expect(headcountByStatus([])).toEqual([]);
  });
});

describe('currency-scoped totals (RPT-007)', () => {
  it('produces one total per currency rather than a mixed total', () => {
    const values = [
      { amount: '100.00', currency: 'USD' },
      { amount: '200.00', currency: 'USD' },
      { amount: '300.00', currency: 'EUR' },
    ];

    const groups = groupByCurrency(values);
    expect(groups.size).toBe(2);
    expect(totalSameCurrency(values.filter((v) => v.currency === 'USD'))).toBe('300.00');
  });

  it('refuses to total across currencies', () => {
    expect(() =>
      totalSameCurrency([
        { amount: '100.00', currency: 'USD' },
        { amount: '300.00', currency: 'EUR' },
      ]),
    ).toThrow(/across currencies/);
  });
});
