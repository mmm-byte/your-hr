/**
 * The result shapes of the salary revision operation (D-017).
 *
 * Purpose: the types the **client** form needs, kept in their own module so
 * the form can import them without pulling the database layer into the
 * browser bundle.
 *
 * Called by: src/server/salary-revision.ts (which produces these values) and
 *            src/components/product/salary-revision-form.tsx (which renders
 *            them).
 * Reads: nothing — pure type declarations.
 * Rules: D-017 (the stable error shape), CON-002 (the submitted input
 *        survives a conflict).
 * Tests: tests/integration/salary-revision-action.test.ts
 */

import type { ErrorCode } from '@/lib/error-codes';
import type { SalaryRevisionInput } from '@/schemas/salary-revision';

/**
 * A failure the form can render.
 *
 * The shape mirrors the D-017 error shape in API-CONTRACT.md: a stable
 * code, a safe message, a message per field, and a correlation id.
 */
export interface RevisionFailure {
  readonly ok: false;
  readonly code: ErrorCode;
  readonly message: string;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly correlationId: string;
  /**
   * The values the reader submitted, preserved so the form can show them
   * again after a conflict (CON-002).
   */
  readonly submitted: SalaryRevisionInput | null;
}

/** A successful revision. */
export interface RevisionSuccess {
  readonly ok: true;
  /** The id of the appended salary record. */
  readonly revisionId: number;
  /** The employee's new compensation version (CON-003). */
  readonly version: number;
  /** The correlation id of the audit event. */
  readonly correlationId: string;
}

/** The outcome of a revision attempt. */
export type RevisionOutcome = RevisionSuccess | RevisionFailure;
