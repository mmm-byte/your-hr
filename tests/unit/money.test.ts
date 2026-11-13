/**
 * Covers:
 * - MON-002 exact decimal semantics (no binary floating point)
 * - MON-003 central formatting with an explicit currency
 * - MON-004 no mixed-currency total
 * - RPT-005, RPT-006 display rounding
 *
 * Does not cover:
 * - Rendering in the UI (tests/component/money-display.test.tsx)
 * - Database numeric storage (tests/integration/schema.integration.test.ts)
 */
import { describe, expect, it } from 'vitest';
import { aggregateByCurrency, averageMoney, medianMoney } from '@/lib/analytics';
import {
  addMoney,
  compareMoney,
  formatMoney,
  fromMinorUnits,
  groupByCurrency,
  subtractMoney,
  toMinorUnits,
  totalSameCurrency,
} from '@/lib/money';

describe('toMinorUnits', () => {
  it('converts an exact decimal to integer cents', () => {
    expect(toMinorUnits('54206.05')).toBe(5_420_605n);
    expect(toMinorUnits('0.01')).toBe(1n);
    expect(toMinorUnits('50000')).toBe(5_000_000n);
    expect(toMinorUnits('9647953.00')).toBe(964_795_300n);
  });

  it('treats a single decimal place as tenths, not as a rescaled value', () => {
    expect(toMinorUnits('1.5')).toBe(150n);
  });

  it('rejects a malformed value', () => {
    expect(() => toMinorUnits('abc')).toThrow();
    expect(() => toMinorUnits('')).toThrow();
    expect(() => toMinorUnits('12.3.4')).toThrow();
  });
});

describe('fromMinorUnits', () => {
  it('round-trips exactly', () => {
    expect(fromMinorUnits(toMinorUnits('54206.05'))).toBe('54206.05');
    expect(fromMinorUnits(toMinorUnits('123456789.12'))).toBe('123456789.12');
  });
});

describe('addMoney', () => {
  it('is exact where floating point is not', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE 754. Here it must be exactly 0.30.
    expect(addMoney('0.10', '0.20')).toBe('0.30');
  });

  it('sums a large series without drift', () => {
    let total = '0.00';
    for (let i = 0; i < 10_000; i += 1) {
      total = addMoney(total, '0.01');
    }
    expect(total).toBe('100.00');
  });
});

describe('subtractMoney and compareMoney', () => {
  it('subtracts exactly', () => {
    expect(subtractMoney('54206.05', '12000.00')).toBe('42206.05');
  });

  it('orders amounts by value, not by string', () => {
    expect(compareMoney('9.00', '10.00')).toBe(-1);
    expect(compareMoney('10.00', '9.00')).toBe(1);
    expect(compareMoney('10.00', '10.00')).toBe(0);
  });
});

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
});

describe('formatMoney', () => {
  it('includes the ISO currency code so the value is unambiguous', () => {
    const formatted = formatMoney('54206.05', 'USD');
    expect(formatted).toContain('USD');
    expect(formatted).toContain('54,206.05');
  });

  it('formats using the currency convention for each currency', () => {
    expect(formatMoney('1000', 'INR')).toContain('INR');
    expect(formatMoney('1000', 'EUR')).toContain('EUR');
  });

  it('can omit the code when the context already makes it obvious', () => {
    expect(formatMoney('54206.05', 'USD', { includeCode: false })).not.toContain('USD');
  });
});

describe('groupByCurrency', () => {
  it('separates amounts by currency so they cannot be totalled together', () => {
    const groups = groupByCurrency([
      { amount: '100.00', currency: 'USD' },
      { amount: '200.00', currency: 'USD' },
      { amount: '300.00', currency: 'EUR' },
    ]);

    expect(groups.get('USD')).toEqual(['100.00', '200.00']);
    expect(groups.get('EUR')).toEqual(['300.00']);
    expect(groups.get('USD')).not.toBe(groups.get('EUR'));
  });
});

describe('totalSameCurrency', () => {
  it('totals amounts that share a currency', () => {
    expect(totalSameCurrency(['100.00', '200.50'])).toBe('300.50');
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
});
