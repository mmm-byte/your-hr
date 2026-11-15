'use server';

/**
 * The salary revision server action (SAL-010, AUD-001, CON-001, D-017).
 *
 * Purpose: the action the revision form posts to. It is a **server
 * action**, so the browser never holds the database handle and the
 * validation runs on the server where it is authoritative.
 *
 * Called by: src/components/product/salary-revision-form.tsx, through
 *            `useActionState`.
 * Reads: nothing directly — the action delegates to `applySalaryRevision`.
 * Writes: the salary revision and its audit event, through the operation.
 * Rules: SAL-010 (atomicity), AUD-001 (audit evidence), CON-001 (the
 *        version token), D-017 (the stable error shape).
 * Tests: tests/integration/salary-revision-action.test.ts
 *
 * Design notes
 * ------------
 * - This file is a `'use server'` module, so Next.js turns it into an RPC
 *   endpoint and only the **action** crosses the boundary. The operation
 *   and the database layer stay on the server (D-015).
 * - The signature is the one `useActionState` expects — the previous state
 *   and the submitted payload — so the form holds the result of the last
 *   submission without a second piece of state.
 */

import { createAppError, ERROR_CODES } from '@/lib/error-codes';
import { applySalaryRevision, parseRevisionSubmission } from './salary-revision';
import type { RevisionOutcome } from './revision-outcome';

/**
 * Apply one salary revision.
 *
 * Never throws: a failure is a result the form can render, with a code the
 * form maps to a recovery action (D-017, UX-JOURNEY Step 6).
 */
export async function reviseSalary(
  _previousState: RevisionOutcome | null,
  formData: FormData,
): Promise<RevisionOutcome> {
  const submission = parseRevisionSubmission(formData);

  if (!submission.ok) {
    // The submission did not even have a valid shape. The field errors are
    // carried through, so the form can put each message next to the input
    // that caused it (UX-JOURNEY Step 6).
    const error = createAppError(ERROR_CODES.VALIDATION_ERROR, {
      correlationId: `req-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
      fieldErrors: submission.fieldErrors,
    });

    return {
      ok: false,
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
      correlationId: error.correlationId,
      submitted: null,
    };
  }

  return applySalaryRevision(submission.input);
}
