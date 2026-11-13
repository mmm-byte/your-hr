/**
 * Date-only values (RPT-004).
 *
 * A date such as a salary effective date is a *calendar day*, not an instant.
 * `new Date('2026-03-01')` parses as midnight UTC, then formats in the local
 * timezone — which renders as 28 February in any negative-offset timezone and
 * as 1 March elsewhere. That is a real bug class: a salary would appear to start
 * on the wrong day.
 *
 * This module makes the mistake structurally impossible by never constructing a
 * `Date` for a date-only value. Dates stay as `YYYY-MM-DD` strings, are compared
 * lexicographically (which is correct for ISO dates), and are formatted from
 * their parts.
 *
 * Called by: the directory query layer, the profile, the revision form, and the
 * central date formatter.
 * Rules: RPT-004, RPT-001.
 * Tests: tests/unit/date-only.test.ts
 */

/** A calendar day in `YYYY-MM-DD` form. */
export type DateOnly = string;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when the value is a well-formed `YYYY-MM-DD` string that names a real
 * calendar day.
 *
 * `2026-02-30` is rejected: the shape is right but the day does not exist.
 */
export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return isRealCalendarDay(year, month, day);
}

function isRealCalendarDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/**
 * Today's calendar date in the server's local timezone, as `YYYY-MM-DD`.
 *
 * This is the default reporting date (RPT-001). It is read once, at the edge,
 * rather than from a clock inside the domain layer — so tests inject their own
 * value and never depend on wall-clock time (TESTING.md → Determinism rules).
 */
export function todayDateOnly(now: Date = new Date()): DateOnly {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compare two date-only values.
 *
 * Lexicographic comparison is correct for ISO `YYYY-MM-DD` because the format
 * is fixed-width and sorts by year, then month, then day.
 */
export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** True when `date` is on or before `boundary`. */
export function isOnOrBefore(date: DateOnly, boundary: DateOnly): boolean {
  return compareDateOnly(date, boundary) <= 0;
}

/** True when `date` is on or after `boundary`. */
export function isOnOrAfter(date: DateOnly, boundary: DateOnly): boolean {
  return compareDateOnly(date, boundary) >= 0;
}

/** True when `date` falls within the inclusive range. */
export function isWithinRange(
  date: DateOnly,
  start: DateOnly,
  end: DateOnly,
): boolean {
  return isOnOrAfter(date, start) && isOnOrBefore(date, end);
}

/**
 * Add whole days to a date-only value.
 *
 * Uses `Date.UTC` purely as a day-counting calendar, then formats the result
 * back to ISO parts. The intermediate `Date` is never exposed and never
 * formatted in a local timezone, so no day shift can occur.
 */
export function addDays(date: DateOnly, days: number): DateOnly {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from: DateOnly, to: DateOnly): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * Format a date-only value for display.
 *
 * `Intl.DateTimeFormat` is given explicit UTC parts rather than a `Date`, so the
 * rendered day is always the stored day regardless of the viewer's timezone.
 */
export function formatDateOnly(
  date: DateOnly,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
  locale = 'en-US',
): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
  return formatter.format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Format a date-only value as `DD Mon YYYY`, e.g. `1 Mar 2026`.
 *
 * The day-first order is the format the product's own copy uses — "Workforce
 * as of 12 Nov 2026", "Scheduled — effective 1 Mar 2027" (UX-JOURNEY §2, §4).
 * `Intl.DateTimeFormat` cannot produce that order with the `en-US` locale, so
 * the parts are formatted individually and joined.
 *
 * The parts come from the stored string, never from a `Date`, so the rendered
 * day is always the stored day (RPT-004).
 */
export function formatDateLong(date: DateOnly, locale = 'en-US'): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const monthName = new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));

  return `${day} ${monthName} ${year}`;
}
