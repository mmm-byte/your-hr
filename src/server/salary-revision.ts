/**
 * The salary revision operation (SAL-002…SAL-011, ELG-001…ELG-005,
 * CON-001…CON-003, AUD-001…AUD-004, ACC-003, D-017).
 *
 * Purpose: the application operation behind the revision form. It turns an
 * untrusted form submission into a written salary revision, or into a safe
 * failure the form can render.
 *
 * Called by: the `reviseSalary` server action, which the form posts to.
 * Reads: the employee's employment context, their current salary, and their
 *        existing effective dates (src/db/queries/salary-revision.ts).
 * Writes: salary_records and audit_events, in one transaction, through
 *         `writeSalaryRevision`.
 * Rules: SAL-002 (a positive salary), SAL-003 (a bonus of 0-100), SAL-006
 *        (no duplicate effective date), SAL-009 (a reason is required),
 *        SAL-010 (atomicity), SAL-011 (a stale write conflicts), ELG-001
 *        (a terminated employee is rejected), ELG-002/ELG-003 (the
 *        effective-date window), ELG-004 (the currency is fixed), CON-001
 *        (the version token), CON-002 (the submitted input survives a
 *        conflict), CON-003 (the version increments), AUD-002 (the audit
 *        evidence), AUD-004 (no raw error reaches the user).
 * Tests: tests/integration/salary-revision.test.ts
 *
 * Design notes
 * ------------
 * - **The domain rules run before the write.** `validateSalaryRevision` in
 *   `src/lib/salary-rules.ts` checks the eligibility window, the fixed
 *   currency, the duplicate effective date, the reason, and the amounts.
 *   The write layer repeats the two checks that must hold even if a caller
 *   bypasses this operation (the eligibility gate and the version), because
 *   "server-side" has to mean the database, not just this function.
 * - **A conflict preserves the user's input** (CON-002). The submitted
 *   values come back with the failure, so the form can show them again and
 *   the reader can re-apply the revision after reviewing what changed.
 * - **Nothing raw escapes.** Every failure becomes a code from the D-017
 *   catalogue with a correlation id. The correlation id is the only
 *   diagnostic handle the reader gets (AUD-004).
 */

import 'server-only';

import { getDatabase } from '@/db/client';
import {
  readRevisionContext,
  writeSalaryRevision,
  type RevisionDatabase,
} from '@/db/queries/salary-revision';
import { createAppError, ERROR_CODES } from '@/lib/error-codes';
import { validateSalaryRevision, type RuleViolation } from '@/lib/salary-rules';
import {
  parseSalaryRevision,
  type SalaryRevisionInput,
} from '@/schemas/salary-revision';
import type { RevisionOutcome } from './revision-outcome';

export type { RevisionFailure, RevisionOutcome, RevisionSuccess } from './revision-outcome';

/**
 * A correlation id for a request that has no other handle.
 *
 * It is short, random, and carries nothing about the request — it is a
 * handle to quote to support, not a description of what happened (AUD-004).
 */
function newCorrelationId(): string {
  return `req-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/**
 * The field errors a set of rule violations produces.
 *
 * A violation without a field — an ineligible employee, for example — is a
 * failure of the whole submission, so it is reported under the general key
 * rather than highlighted on an input.
 */
function fieldErrorsFrom(violations: readonly RuleViolation[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const violation of violations) {
    const key = violation.field ?? 'form';
    if (!(key in fieldErrors)) {
      fieldErrors[key] = violation.message;
    }
  }

  return fieldErrors;
}

/**
 * Apply one salary revision.
 *
 * The operation the form calls. It validates the submission, checks the
 * employee's state and the concurrency token, writes the revision and its
 * audit evidence atomically, and returns either the new state or a safe
 * failure.
 *
 * @param input the validated submission
 * @param db the database handle, so the operation can be exercised against
 *            PGlite in the integration tests
 */
export async function applySalaryRevision(
  input: SalaryRevisionInput,
  db: RevisionDatabase = getDatabase() as unknown as RevisionDatabase,
): Promise<RevisionOutcome> {
  const correlationId = newCorrelationId();

  // The employee must exist. This is a controlled not-found, not a crash.
  const context = await readRevisionContext(db, input.employeeId);
  if (context === null) {
    const error = createAppError(ERROR_CODES.EMPLOYEE_NOT_FOUND, { correlationId });
    return {
      ok: false,
      code: error.code,
      message: error.message,
      fieldErrors: {},
      correlationId,
      submitted: input,
    };
  }

  // **The concurrency check comes first.** A stale write means the reader is
  // looking at a form that no longer describes the employee's compensation,
  // so every other rule would be judged against a state that has already
  // moved on. The conflict is the honest answer; a duplicate-date message
  // would send the reader after the wrong problem (CON-001, SAL-011).
  //
  // The write repeats this check inside the transaction, so this is the
  // friendly early answer and the write is the authoritative one.
  if (input.expectedVersion !== context.employee.version) {
    const error = createAppError(ERROR_CODES.SALARY_VERSION_CONFLICT, { correlationId });
    return {
      ok: false,
      code: error.code,
      message: error.message,
      fieldErrors: {},
      correlationId,
      // The reader's input survives, so the revision can be re-applied
      // after they have reviewed what changed (CON-002).
      submitted: input,
    };
  }

  // The domain rules run against the employee's real state: the employment
  // window, the fixed currency, the duplicate effective date, the reason,
  // and the amounts (SAL-002, SAL-003, SAL-006, SAL-009, ELG-002…ELG-004).
  const violations = validateSalaryRevision(
    {
      baseSalary: input.baseSalary,
      bonusPct: input.bonusPct,
      currency: input.currency,
      effectiveFrom: input.effectiveFrom,
      reason: input.reason,
    },
    {
      employeeId: context.employee.id,
      employmentStatus: context.employee.employmentStatus,
      hireDate: context.employee.hireDate,
      terminationDate: context.employee.terminationDate,
      currency: context.employee.currency,
      version: context.employee.version,
    },
    context.existingEffectiveDates,
  );

  if (violations.length > 0) {
    const first = violations[0];
    const error = createAppError(
      first?.code ?? ERROR_CODES.VALIDATION_ERROR,
      {
        correlationId,
        fieldErrors: fieldErrorsFrom(violations),
        // A rule violation carries its own message, which is written for the
        // person who has to act on it.
        message: first?.message,
      },
    );

    return {
      ok: false,
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
      correlationId,
      submitted: input,
    };
  }

  const result = await writeSalaryRevision(db, {
    employeeId: input.employeeId,
    baseSalary: input.baseSalary,
    bonusPct: input.bonusPct,
    currency: input.currency,
    effectiveFrom: input.effectiveFrom,
    reason: input.reason,
    expectedVersion: input.expectedVersion,
    correlationId,
  });

  if (result.ok) {
    return {
      ok: true,
      revisionId: result.revisionId,
      version: result.version,
      correlationId,
    };
  }

  return {
    ok: false,
    code: result.code,
    message: result.message,
    fieldErrors: result.fieldErrors,
    correlationId,
    submitted: input,
  };
}

/**
 * The result of reading a form submission.
 *
 * Either the validated revision, or the field errors that stopped it.
 */
export type RevisionSubmission =
  | { readonly ok: true; readonly input: SalaryRevisionInput }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, string>> };

/**
 * Parse a form submission into a validated revision.
 *
 * The one place the raw `FormData` is read, so nothing downstream has to
 * know how the values travelled.
 */
export function parseRevisionSubmission(formData: FormData): RevisionSubmission {
  const parsed = parseSalaryRevision({
    employeeId: formData.get('employeeId'),
    baseSalary: formData.get('baseSalary'),
    bonusPct: formData.get('bonusPct'),
    currency: formData.get('currency'),
    effectiveFrom: formData.get('effectiveFrom'),
    reason: formData.get('reason'),
    expectedVersion: formData.get('expectedVersion'),
  });

  return parsed.ok ? { ok: true, input: parsed.data } : { ok: false, fieldErrors: parsed.fieldErrors };
}
