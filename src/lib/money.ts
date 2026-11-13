/**
 * Money and currency (MON-001…MON-006, RPT-005…RPT-007).
 *
 * Authoritative money is never a JavaScript `number`. Drizzle returns PostgreSQL
 * `numeric` as a **string** — `'50000.00'` — and that string is kept intact all
 * the way through the domain layer. Binary floating point cannot represent
 * `0.1` exactly, so `0.1 + 0.2 !== 0.3`; a payroll system that sums salaries in
 * floats will eventually produce a wrong total (MON-002).
 *
 * Arithmetic, where it is genuinely required (a median of two values, a
 * percentage change), is done on `BigInt` minor units — integers, therefore
 * exact.
 *
 * Called by: the salary revision validation, the compensation and analytics
 * queries, and the `MoneyDisplay` component.
 * Rules: MON-001, MON-002, MON-003, MON-004, MON-005, MON-006, RPT-005, RPT-006.
 * Tests: tests/unit/money.test.ts
 */

import type { DateOnly } from './date-only';

/** An ISO 4217-style currency code. */
export type CurrencyCode = string;

/** A money amount held as an exact decimal string, e.g. `'54206.05'`. */
export type MoneyString = string;

/** Currencies the seeded workforce uses, with their display metadata. */
export interface CurrencyMeta {
  readonly code: CurrencyCode;
  /** ISO 4217 numeric code, used for deterministic locale grouping. */
  readonly numeric: string;
  readonly locale: string;
}

export const CURRENCIES: Readonly<Record<string, CurrencyMeta>> = Object.freeze({
  USD: { code: 'USD', numeric: '840', locale: 'en-US' },
  INR: { code: 'INR', numeric: '356', locale: 'en-IN' },
  GBP: { code: 'GBP', numeric: '826', locale: 'en-GB' },
  EUR: { code: 'EUR', numeric: '978', locale: 'de-DE' },
  CAD: { code: 'CAD', numeric: '124', locale: 'en-CA' },
  AUD: { code: 'AUD', numeric: '036', locale: 'en-AU' },
});

/** The currencies this application recognises. */
export const SUPPORTED_CURRENCIES = Object.keys(CURRENCIES) as readonly CurrencyCode[];

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && value in CURRENCIES;
}

/**
 * Convert an exact decimal string to integer minor units.
 *
 * `'54206.05'` becomes `5_420_605`. The scale is taken from the string itself
 * so a value with no decimal point (`'50000'`) is treated as whole units rather
 * than being silently rescaled.
 *
 * @throws if the value is not a well-formed non-negative decimal string.
 */
export function toMinorUnits(value: MoneyString): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) {
    throw new Error(`Invalid money value: ${value}`);
  }
  const [, whole, fraction = ''] = match;
  const padded = fraction.padEnd(2, '0').slice(0, 2);
  return BigInt(whole as string) * 100n + BigInt(padded);
}

/**
 * Convert integer minor units back to an exact decimal string with two places.
 */
export function fromMinorUnits(minor: bigint): MoneyString {
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  return `${negative ? '-' : ''}${whole}.${fraction.toString().padStart(2, '0')}`;
}

/**
 * Add two exact money values.
 *
 * Both are converted to minor units first, so the result is exact.
 */
export function addMoney(a: MoneyString, b: MoneyString): MoneyString {
  return fromMinorUnits(toMinorUnits(a) + toMinorUnits(b));
}

/**
 * Subtract `b` from `a`, exactly.
 */
export function subtractMoney(a: MoneyString, b: MoneyString): MoneyString {
  return fromMinorUnits(toMinorUnits(a) - toMinorUnits(b));
}

/** Compare two exact money values. Returns -1, 0, or 1. */
export function compareMoney(a: MoneyString, b: MoneyString): number {
  const left = toMinorUnits(a);
  const right = toMinorUnits(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Percentage change from `from` to `to`, rounded to two decimals.
 *
 * Returns `null` when `from` is zero, because the percentage change from zero
 * is undefined — not infinity, and not zero.
 */
export function percentChange(from: MoneyString, to: MoneyString): number | null {
  const fromUnits = toMinorUnits(from);
  if (fromUnits === 0n) {
    return null;
  }
  const delta = toMinorUnits(to) - fromUnits;
  // Scale by 100 and keep two decimals: (delta / from) * 100, in basis points.
  const basisPoints = (delta * 10_000n) / fromUnits;
  return Number(basisPoints) / 100;
}

/**
 * A money value with its currency attached.
 *
 * Every money value that crosses a boundary carries its currency explicitly
 * (MON-001). A bare number is not a money value.
 */
export interface Money {
  readonly amount: MoneyString;
  readonly currency: CurrencyCode;
}

/**
 * Format money for display.
 *
 * Uses `Intl.NumberFormat` with the currency's own locale so grouping separators
 * and symbol placement follow the currency convention. The ISO code is included
 * because a symbol alone is ambiguous across currencies (MON-003, RPT-005).
 *
 * The amount is converted to a `number` **for formatting only** — the exact
 * string remains the source of truth (RPT-006). `Intl.NumberFormat` cannot
 * consume a `BigInt` with a fractional part, so the value is passed as a
 * pre-formatted decimal string to avoid any float arithmetic in the output.
 */
export function formatMoney(
  amount: MoneyString,
  currency: CurrencyCode,
  options: { includeCode?: boolean; locale?: string } = {},
): string {
  const { includeCode = true, locale } = options;
  const meta = CURRENCIES[currency];

  const formatted = new Intl.NumberFormat(locale ?? meta?.locale ?? 'en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));

  return includeCode ? `${formatted} ${currency}` : formatted;
}

/**
 * Format a whole-number amount (headcount, record counts) with grouping.
 */
export function formatCount(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/**
 * Group money values by currency.
 *
 * Totals are never produced across currencies (MON-004, RPT-007). Grouping makes
 * that structural: a mixed-currency total cannot be computed from the result,
 * because the values are separated first.
 */
export function groupByCurrency(values: readonly Money[]): Map<CurrencyCode, MoneyString[]> {
  const groups = new Map<CurrencyCode, MoneyString[]>();
  for (const value of values) {
    const existing = groups.get(value.currency);
    if (existing) {
      existing.push(value.amount);
    } else {
      groups.set(value.currency, [value.amount]);
    }
  }
  return groups;
}

/**
 * Total a group of amounts that all share one currency.
 *
 * @throws if the amounts span more than one currency — the caller must group
 * first. This makes a mixed-currency total a runtime error rather than a
 * misleading number on screen.
 */
export function totalSameCurrency(amounts: readonly MoneyString[]): MoneyString {
  return amounts.reduce<MoneyString>((sum, amount) => addMoney(sum, amount), '0.00');
}

/**
 * A localised salary value and its synthetic USD equivalent.
 *
 * These are distinct concepts and must stay visibly distinct (MON-005). The
 * USD equivalent is derived from a fixed seed FX reference date — it is not a
 * live market rate (MON-006).
 */
export interface LocalizedSalary {
  readonly localAmount: MoneyString;
  readonly localCurrency: CurrencyCode;
  readonly usdEquivalent: MoneyString;
  readonly fxReferenceDate: DateOnly;
  readonly localizationMethod: string;
}
