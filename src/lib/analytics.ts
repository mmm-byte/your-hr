/**
 * Analytics helpers (ANA-001…ANA-007, RPT-006, RPT-007).
 *
 * Median and average over **exact** money values. A median computed by sorting
 * JavaScript numbers is technically fine for ordering, but an *average* summed
 * in floating point drifts: summing 10,000 salaries in cents can end up a cent
 * off. These helpers sum in `BigInt` minor units so the result is exact.
 *
 * The median must handle even-length sets correctly (ANA-003): the average of
 * the two middle values, not either one of them.
 *
 * Called by: the analytics page and the compensation aggregates.
 * Rules: ANA-001, ANA-002, ANA-003, ANA-004, ANA-005, ANA-006, RPT-006.
 * Tests: tests/unit/analytics.test.ts
 */

import { fromMinorUnits, toMinorUnits, type CurrencyCode, type MoneyString } from './money';

/**
 * The median of a set of amounts.
 *
 * Returns `null` for an empty set — never `0` (ANA-004). A median of zero and
 * "no data" are different facts and must not be conflated.
 *
 * @param amounts exact decimal strings, all in the same currency
 */
export function medianMoney(amounts: readonly MoneyString[]): MoneyString | null {
  if (amounts.length === 0) {
    return null;
  }

  const units = amounts.map(toMinorUnits).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const middle = Math.floor(units.length / 2);

  if (units.length % 2 === 1) {
    return fromMinorUnits(units[middle] as bigint);
  }

  // Even-length set: the median is the mean of the two middle values (ANA-003).
  // Summing in minor units and dividing by 2 keeps it exact for whole cents;
  // a half-cent result rounds to the nearest cent.
  const lower = units[middle - 1] as bigint;
  const upper = units[middle] as bigint;
  const sum = lower + upper;
  const rounded = divideRoundHalfUp(sum, 2n);
  return fromMinorUnits(rounded);
}

/**
 * The arithmetic mean of a set of amounts, rounded to the nearest cent.
 *
 * Returns `null` for an empty set (ANA-004).
 */
export function averageMoney(amounts: readonly MoneyString[]): MoneyString | null {
  if (amounts.length === 0) {
    return null;
  }

  const total = amounts.reduce<bigint>((sum, amount) => sum + toMinorUnits(amount), 0n);
  return fromMinorUnits(divideRoundHalfUp(total, BigInt(amounts.length)));
}

/**
 * Divide by rounding half away from zero.
 *
 * `BigInt` division truncates toward zero, so a remainder of exactly half must
 * be resolved explicitly — otherwise `averageMoney(['0.01', '0.02'])` would give
 * `0.01` instead of `0.02`.
 */
function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error('Division by zero');
  }
  const negative = numerator < 0n !== denominator < 0n;
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const absDenominator = denominator < 0n ? -denominator : denominator;

  const quotient = absNumerator / absDenominator;
  const remainder = absNumerator % absDenominator;
  const doubled = remainder * 2n;

  const rounded =
    doubled >= absDenominator ? quotient + 1n : quotient;

  return negative ? -rounded : rounded;
}

/** A count with its dimension label, used by the analytics groups. */
export interface CountGroup {
  readonly label: string;
  readonly count: number;
}

/**
 * Group and count values.
 *
 * `groupBy` returns the group label for each row. Groups are returned sorted by
 * count descending, then label ascending, so the output is stable regardless of
 * the database's row order — a stable ordering prevents the page from jittering
 * between requests (UI.md → Table UX).
 */
export function countBy<T>(
  rows: readonly T[],
  groupBy: (row: T) => string,
): CountGroup[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = groupBy(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * A money aggregate for one currency.
 *
 * Currency is carried on the aggregate itself so a mixed-currency total cannot
 * be represented by accident (MON-004, RPT-007, ANA-005).
 */
export interface CurrencyAggregate {
  readonly currency: CurrencyCode;
  readonly count: number;
  readonly median: MoneyString | null;
  readonly average: MoneyString | null;
  readonly minimum: MoneyString | null;
  readonly maximum: MoneyString | null;
}

/**
 * Aggregate amounts within a single currency.
 *
 * The caller groups by currency first. This function never mixes currencies.
 */
export function aggregateByCurrency(
  currency: CurrencyCode,
  amounts: readonly MoneyString[],
): CurrencyAggregate {
  if (amounts.length === 0) {
    return {
      currency,
      count: 0,
      median: null,
      average: null,
      minimum: null,
      maximum: null,
    };
  }

  const units = amounts.map(toMinorUnits).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    currency,
    count: amounts.length,
    median: medianMoney(amounts),
    average: averageMoney(amounts),
    minimum: fromMinorUnits(units[0] as bigint),
    maximum: fromMinorUnits(units[units.length - 1] as bigint),
  };
}

/**
 * Headcount by employment status.
 *
 * Defaults to the current active and on-leave workforce (ANA-002). Terminated
 * employees are included only when the caller explicitly asks for them.
 */
export function headcountByStatus(
  rows: readonly { employmentStatus: string }[],
  options: { includeTerminated?: boolean } = {},
): CountGroup[] {
  const filtered = options.includeTerminated
    ? rows
    : rows.filter((row) => row.employmentStatus === 'active' || row.employmentStatus === 'on_leave');

  return countBy(filtered, (row) => row.employmentStatus);
}
