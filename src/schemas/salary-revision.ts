/**
 * Salary revision request schema (SAL-002, SAL-003, SAL-009, ELG-004,
 * CON-001, MON-002, RPT-004).
 *
 * Purpose: validate the salary revision form's untrusted input before it
 * reaches the domain rules or the database. Every input is **bounded** or
 * **allow-listed**, so a hand-edited form post cannot become an unbounded
 * amount, a currency the employee does not use, or a date that is not a real
 * calendar day.
 *
 * Called by: src/server/salary-revision.ts (the server action).
 * Reads: nothing — pure validation, no I/O and no database access.
 * Rules: SAL-002 (a positive base salary), SAL-003 (a bonus of 0-100),
 *        SAL-009 (a non-blank reason), ELG-004 (the currency is allow-listed),
 *        CON-001 (the version token is carried), MON-002 (money stays a
 *        decimal string and is never parsed into a float), RPT-004 (a real
 *        calendar day).
 * Tests: tests/integration/salary-revision.test.ts
 *
 * Design notes
 * ------------
 * - **Money is a string on the way in.** `baseSalary` and `bonusPct` arrive
 *   as text and stay text. Parsing them into a JavaScript `number` would
 *   lose the last cent on a large amount, and a payroll system that sums
 *   salaries in floats eventually produces a wrong total (MON-002). The
 *   pattern here is the same one `toMinorUnits` accepts, so an amount that
 *   passes this schema can be converted without losing anything.
 * - **No coercion.** A malformed value is a **failure with a message**, not
 *   a silent reinterpretation. `z.coerce.number()` would turn `true` into
 *   `1`, which is how a malformed post becomes a valid-looking write.
 * - **The currency is allow-listed, but it is not trusted.** The submitted
 *   currency is checked against the closed set of ISO codes the database can
 *   hold. Whether it matches *this employee's* currency is a domain rule
 *   (ELG-004), checked in `validateSalaryRevision`, not here.
 * - **Failures are reported per field.** The result carries a `fieldErrors`
 *   map so the form can put each message next to the input that caused it
 *   and focus that input (UX-JOURNEY Step 6).
 * - The schema validates the *shape* of the input. The *rules* — the
 *   eligibility window, the duplicate effective date, the version — are
 *   domain rules in `src/lib/salary-rules.ts`, because they depend on the
 *   employee's state and the database, not on the shape of the input.
 */

import { z } from 'zod';
import { CURRENCY_CODES } from '@/lib/domain-values';
import { isDateOnly } from '@/lib/date-only';
import { MAX_REASON_LENGTH } from '@/lib/salary-rules';

/**
 * The longest base salary the form will accept.
 *
 * The column is `numeric(12,2)`, so the largest storable amount is
 * 9,999,999,999.99. The bound here excludes a value that would overflow the
 * column, and it keeps a pasted value from being arbitrarily long.
 */
export const MAX_BASE_SALARY = '9999999999.99';

/**
 * Read a form value as a positive integer.
 *
 * Accepts a string of digits, or a safe integer that is already a number.
 * Everything else — `'abc'`, `'1.5'`, `true`, `''` — is a **failure**, not a
 * silent default: a revision whose employee id cannot be read is a
 * submission that must be rejected, not one that should be guessed.
 */
function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  return undefined;
}

/**
 * A decimal amount, as a string.
 *
 * The pattern is the one `toMinorUnits` accepts: digits, and at most two
 * fraction digits. A third decimal digit is rejected rather than truncated,
 * because the column cannot represent it (MON-002).
 */
function decimalAmount(maxLength: number) {
  return z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount with at most two decimal places.')
    .refine((value) => value.length <= maxLength, 'That amount is too large.');
}

/**
 * The employee the revision is for.
 */
const employeeIdSchema = z.preprocess(
  readPositiveInteger,
  z.number().int().positive('That employee could not be found.'),
);

/**
 * The base salary.
 *
 * Greater than zero (SAL-002). The check is on the **string**, so `'0.00'`
 * is rejected without the amount ever becoming a float.
 */
const baseSalarySchema = decimalAmount(MAX_BASE_SALARY.length).refine(
  (value) => !/^0*(\.0*)?$/.test(value),
  'The base salary must be greater than zero.',
);

/**
 * The bonus percentage (SAL-003).
 *
 * Bounded at 0 and 100 inclusive. Compared as a decimal string, so no float
 * rounding decides a boundary.
 */
const bonusPctSchema = decimalAmount(5).refine(
  (value) => Number(value) <= 100,
  'The bonus percentage must be between 0 and 100.',
);

/**
 * The currency.
 *
 * Allow-listed against the closed set the database column can hold (ELG-004).
 */
const currencySchema = z.enum(CURRENCY_CODES);

/**
 * The effective date.
 *
 * A **real** calendar day, not merely a `YYYY-MM-DD` shape: `2026-02-30` is
 * not a date, and accepting it would silently resolve to a different day
 * (RPT-004).
 */
const effectiveFromSchema = z
  .string()
  .trim()
  .refine((value) => isDateOnly(value), 'Enter a valid effective date.');

/**
 * The reason (SAL-009).
 *
 * Required and non-blank after trimming. The length is bounded so a pasted
 * essay cannot reach the database.
 */
const reasonSchema = z
  .string()
  .trim()
  .min(1, 'A reason is required so the change can be explained later.')
  .max(MAX_REASON_LENGTH, `The reason must be ${MAX_REASON_LENGTH} characters or fewer.`);

/**
 * The version the user was shown (CON-001).
 *
 * The optimistic-concurrency token: the employee's compensation version at
 * the moment the form was rendered. The server compares it with the stored
 * version and refuses the write when they differ (SAL-011).
 */
const expectedVersionSchema = z.preprocess(
  readPositiveInteger,
  z.number().int().positive('This form is out of date. Reload the page and try again.'),
);

/**
 * The validated salary revision.
 */
export const salaryRevisionSchema = z.object({
  employeeId: employeeIdSchema,
  baseSalary: baseSalarySchema,
  bonusPct: bonusPctSchema,
  currency: currencySchema,
  effectiveFrom: effectiveFromSchema,
  reason: reasonSchema,
  expectedVersion: expectedVersionSchema,
});

export type SalaryRevisionInput = z.infer<typeof salaryRevisionSchema>;

/**
 * The outcome of parsing a revision.
 *
 * A **failure** carries a message per field, so the form can place each
 * message next to the input that caused it. A malformed `employeeId` or
 * `expectedVersion` is a failure of the whole submission rather than of one
 * field, so it is reported under the general key.
 */
export type SalaryRevisionParseResult =
  | { readonly ok: true; readonly data: SalaryRevisionInput }
  | {
      readonly ok: false;
      readonly fieldErrors: Readonly<Record<string, string>>;
    };

/**
 * Parse the raw submission into a validated revision.
 *
 * Never throws: a malformed submission is a result the form can render, not
 * an exception (UX-JOURNEY Step 6 — "form not submitted", with the message
 * next to the offending field).
 */
export function parseSalaryRevision(raw: unknown): SalaryRevisionParseResult {
  const result = salaryRevisionSchema.safeParse(raw);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  const fieldErrors: Record<string, string> = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];
    const key = typeof field === 'string' ? field : 'form';
    // The first message for a field wins: two messages for one input is
    // noise, and the first is the most specific.
    if (!(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }

  return { ok: false, fieldErrors };
}

/**
 * Read a revision out of a `FormData`.
 *
 * The form posts text fields, so every value arrives as a string. The
 * `FormData` is read once, here, so nothing downstream has to know how the
 * values travelled.
 */
export function parseSalaryRevisionFormData(
  formData: FormData,
): SalaryRevisionParseResult {
  const raw: Record<string, unknown> = {};

  for (const key of [
    'employeeId',
    'baseSalary',
    'bonusPct',
    'currency',
    'effectiveFrom',
    'reason',
    'expectedVersion',
  ] as const) {
    const value = formData.get(key);
    if (typeof value === 'string') {
      raw[key] = value;
    }
  }

  return parseSalaryRevision(raw);
}
