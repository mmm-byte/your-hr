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

  it('rejects a third decimal place rather than truncating it', () => {
    // The column is numeric(12,2): a third decimal is a precision the system
    // cannot represent, so dropping it silently would change the amount.
    expect(() => toMinorUnits('1.234')).toThrow(/more than two decimal places/);
    expect(() => toMinorUnits('0.005')).toThrow(/more than two decimal places/);
  });

  it('accepts a negative amount', () => {
    expect(toMinorUnits('-54206.05')).toBe(-5_420_605n);
    expect(toMinorUnits('-0.01')).toBe(-1n);
  });
});

describe('fromMinorUnits', () => {
  it('round-trips exactly', () => {
    expect(fromMinorUnits(toMinorUnits('54206.05'))).toBe('54206.05');
    expect(fromMinorUnits(toMinorUnits('123456789.12'))).toBe('123456789.12');
  });

  it('round-trips a negative amount without losing the sign', () => {
    expect(fromMinorUnits(toMinorUnits('-54206.05'))).toBe('-54206.05');
    expect(fromMinorUnits(toMinorUnits('-0.01'))).toBe('-0.01');
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

  it('keeps every digit of an amount that a float could not represent', () => {
    // 90071992547409.93 is not exactly representable as a JavaScript number:
    // Number('90071992547409.93') is 90071992547409.94.
    expect(formatMoney('90071992547409.93', 'USD')).toContain('90,071,992,547,409.93');
  });

  it('rejects a malformed amount instead of rendering NaN', () => {
    expect(() => formatMoney('abc', 'USD')).toThrow(/Invalid money value/);
    expect(() => formatMoney('1,000', 'USD')).toThrow(/Invalid money value/);
    expect(() => formatMoney('1.234', 'USD')).toThrow(/Invalid money value/);
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
    expect(
      totalSameCurrency([
        { amount: '100.00', currency: 'USD' },
        { amount: '200.50', currency: 'USD' },
      ]),
    ).toBe('300.50');
  });

  it('refuses to total across currencies', () => {
    expect(() =>
      totalSameCurrency([
        { amount: '100.00', currency: 'USD' },
        { amount: '200.50', currency: 'EUR' },
      ]),
    ).toThrow(/across currencies/);
  });

  it('totals an empty group to zero', () => {
    expect(totalSameCurrency([])).toBe('0.00');
  });
});
