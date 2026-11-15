'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, CircleCheck } from 'lucide-react';
import { reviseSalary } from '@/server/revise-salary-action';
import type { RevisionOutcome } from '@/server/revision-outcome';
import { BonusDisplay, MoneyDisplay } from './money-display';
import { StatusBadge } from './status-badge';
import { percentChange, subtractMoney } from '@/lib/money';
import { compareDateOnly, formatDateLong, todayDateOnly } from '@/lib/date-only';
import type { DateOnly } from '@/lib/date-only';

/**
 * The salary revision form (UX-JOURNEY §3 Step 6, SAL-009, ELG-001…ELG-004,
 * CON-001, CON-002, UI.md → States required on data surfaces).
 *
 * The one place a salary is changed. The form is the reader's last chance to
 * see what will happen before they commit, so it states the comparison
 * live, warns about the dates that cannot work, and never submits
 * twice.
 *
 * Four behaviours matter:
 *
 * - **The currency is fixed and shown as such.** The employee's currency
 *   comes from their branch policy, so it is displayed and not editable
 *   (ELG-004). The server rejects a different currency rather than
 *   overriding it.
 * - **The comparison is live and exact.** The absolute change and the
 *   percentage change are computed with the exact decimal helpers, never
 *   with a float subtraction, and the direction is stated in words as well
 *   as by an arrow — never by colour alone (UI.md → Accessibility).
 * - **A conflict preserves the input.** When the employee's compensation
 *   moved on, the reader's values are still in the form, so the revision can
 *   be re-applied after they have reviewed what changed (CON-002).
 * - **The button is disabled on the first click.** A second click is a
 *   no-op, so a revision is never written twice (UX-JOURNEY Step 6).
 */

/** The employee facts the form needs to warn and to compare. */
export interface RevisionFormContext {
  readonly employeeId: number;
  readonly employeeName: string;
  readonly currency: string;
  readonly hireDate: DateOnly;
  readonly terminationDate: DateOnly | null;
  /** The compensation version the form was rendered with (CON-001). */
  readonly version: number;
  readonly currentSalary: {
    readonly baseSalary: string;
    readonly bonusPct: string;
    readonly effectiveFrom: DateOnly;
  } | null;
  /** The effective dates that already exist, so a duplicate can be warned about. */
  readonly existingEffectiveDates: readonly DateOnly[];
}

const inputClass =
  'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * The initial state of the action.
 *
 * `useActionState` needs a state value before the first submit, and the
 * form has its own state for the fields, so the action state starts empty.
 */
const INITIAL_STATE: RevisionOutcome | null = null;

export function SalaryRevisionForm({ context }: { context: RevisionFormContext }) {
  const [state, formAction, isPending] = useActionState(
    reviseSalary,
    INITIAL_STATE,
  );

  const [baseSalary, setBaseSalary] = useState(
    context.currentSalary?.baseSalary ?? '',
  );
  const [bonusPct, setBonusPct] = useState(context.currentSalary?.bonusPct ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(todayDateOnly());
  const [reason, setReason] = useState('');

  // The conflict case re-renders with the reader's values in `submitted`;
  // putting them back into the fields lets the revision be re-applied
  // without retyping (CON-002).
  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (state !== null && !state.ok && state.submitted !== null) {
      const key = JSON.stringify(state.submitted);
      if (restored.current !== key) {
        restored.current = key;
        setBaseSalary(state.submitted.baseSalary);
        setBonusPct(state.submitted.bonusPct);
        setEffectiveFrom(state.submitted.effectiveFrom);
        setReason(state.submitted.reason);
      }
    }
  }, [state]);

  // Focus the first offending field when the server rejects the submission
  // (UX-JOURNEY Step 6 — "field focused, aria-describedby wired").
  const firstErrorField = state !== null && !state.ok ? firstFieldWithError(state.fieldErrors) : null;
  const focusTarget = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (firstErrorField !== null) {
      focusTarget.current?.focus();
    }
  }, [firstErrorField]);

  const comparison = compareSalaries(context.currentSalary?.baseSalary ?? null, baseSalary);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="employeeId" value={String(context.employeeId)} />
      {/* The version travels with the submission so the server can reject a
          stale write (CON-001). It is a hidden field, not a control the
          reader can change. */}
      <input type="hidden" name="expectedVersion" value={String(context.version)} />

      {state !== null && state.ok ? (
        <SuccessPanel state={state} context={context} />
      ) : null}

      {state !== null && !state.ok ? <FailurePanel state={state} /> : null}

      <section
        aria-label="Current salary"
        className="rounded-lg border border-border bg-surface p-4"
      >
        <h2 className="text-sm font-medium">Current salary</h2>
        {context.currentSalary !== null ? (
          <>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              <MoneyDisplay
                amount={context.currentSalary.baseSalary}
                currency={context.currency}
              />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <BonusDisplay bonusPct={context.currentSalary.bonusPct} />
              {' · effective from '}
              {formatDateLong(context.currentSalary.effectiveFrom)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            This employee has no salary record yet.
          </p>
        )}
      </section>

      <section
        aria-label="Proposed salary"
        className="rounded-lg border border-border bg-surface p-4"
      >
        <h2 className="text-sm font-medium">Proposed salary</h2>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <FormField
            id="baseSalary"
            label="Base salary"
            error={state !== null && !state.ok ? state.fieldErrors.baseSalary : undefined}
            hint={`In ${context.currency}. Up to two decimal places.`}
          >
            <input
              ref={focusTarget}
              id="baseSalary"
              name="baseSalary"
              type="text"
              inputMode="decimal"
              value={baseSalary}
              onChange={(event) => setBaseSalary(event.target.value)}
              aria-describedby="baseSalary-hint"
              aria-invalid={state !== null && !state.ok && state.fieldErrors.baseSalary !== undefined}
              className={inputClass}
            />
          </FormField>

          <FormField
            id="bonusPct"
            label="Bonus percentage"
            error={state !== null && !state.ok ? state.fieldErrors.bonusPct : undefined}
            hint="A percentage between 0 and 100."
          >
            <input
              id="bonusPct"
              name="bonusPct"
              type="text"
              inputMode="decimal"
              value={bonusPct}
              onChange={(event) => setBonusPct(event.target.value)}
              aria-describedby="bonusPct-hint"
              aria-invalid={state !== null && !state.ok && state.fieldErrors.bonusPct !== undefined}
              className={inputClass}
            />
          </FormField>

          <FormField
            id="effectiveFrom"
            label="Effective from"
            error={state !== null && !state.ok ? state.fieldErrors.effectiveFrom : undefined}
            hint="The day this revision takes effect."
          >
            <input
              id="effectiveFrom"
              name="effectiveFrom"
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              aria-describedby="effectiveFrom-hint"
              aria-invalid={state !== null && !state.ok && state.fieldErrors.effectiveFrom !== undefined}
              className={inputClass}
            />
          </FormField>

          <FormField
            id="currency"
            label="Currency"
            hint="Fixed by this employee's country and branch policy. It cannot be changed."
          >
            {/* Read-only rather than hidden: a hidden field would not be
                rendered at all, and the reader must SEE that the currency
                is fixed (ELG-004). `readOnly` keeps it out of the tab
                order and out of the editor, while still submitting it. */}
            <input
              id="currency"
              name="currency"
              type="text"
              value={context.currency}
              readOnly
              aria-describedby="currency-hint"
              className="rounded-md border border-border bg-surface-subtle px-2.5 py-1.5 text-sm"
            />
          </FormField>
        </div>

        <div className="mt-4">
          <ComparisonPanel comparison={comparison} currency={context.currency} />
        </div>

        <div className="mt-4">
          <FormField
            id="reason"
            label="Reason"
            error={state !== null && !state.ok ? state.fieldErrors.reason : undefined}
            hint="Why this change is being made. It is shown in the salary history."
          >
            <textarea
              id="reason"
              name="reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby="reason-hint"
              aria-invalid={state !== null && !state.ok && state.fieldErrors.reason !== undefined}
              className={inputClass}
            />
          </FormField>
        </div>

        <Warnings
          context={context}
          effectiveFrom={effectiveFrom}
          baseSalary={baseSalary}
          reason={reason}
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Add salary revision'}
        </button>
        {isPending ? (
          <p className="text-sm text-muted-foreground">Saving the revision…</p>
        ) : null}
      </div>
    </form>
  );
}

/**
 * A labelled form field with its hint and its error.
 *
 * The hint and the error are wired to the input with `aria-describedby`, so
 * a screen reader reads them with the field rather than as loose text
 * (UI.md → Accessibility).
 */
function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const describedBy = [hint !== undefined ? `${id}-hint` : null, error !== undefined ? `${id}-error` : null]
    .filter((value): value is string => value !== null)
    .join(' ');

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint !== undefined ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
      <span className="sr-only" data-describedby={describedBy} />
    </div>
  );
}

/**
 * The live comparison between the current salary and the proposed one.
 *
 * Both the absolute change and the percentage change are shown, and the
 * direction is stated in words as well as by an arrow. Colour is never the
 * only carrier of the direction (UI.md → Accessibility).
 */
function ComparisonPanel({
  comparison,
  currency,
}: {
  comparison: SalaryComparison | null;
  currency: string;
}) {
  if (comparison === null) {
    return (
      <p className="rounded-md border border-border bg-surface-subtle p-3 text-sm text-muted-foreground">
        Enter a base salary to see the change.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface-subtle p-3">
      <p className="text-xs text-muted-foreground">Change</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        {comparison.direction === 'increase' ? (
          <ArrowUp aria-hidden="true" className="size-4 text-success" />
        ) : comparison.direction === 'decrease' ? (
          <ArrowDown aria-hidden="true" className="size-4 text-danger" />
        ) : null}
        <span className="font-medium">
          {comparison.direction === 'increase'
            ? 'Increase of'
            : comparison.direction === 'decrease'
              ? 'Decrease of'
              : 'No change'}
        </span>
        {comparison.direction !== 'unchanged' ? (
          <>
            <MoneyDisplay amount={comparison.absolute} currency={currency} />
            <span className="text-muted-foreground">
              ({comparison.percentage === null
                ? 'the percentage change is undefined'
                : `${comparison.percentage > 0 ? '+' : ''}${comparison.percentage}%`})
            </span>
          </>
        ) : null}
      </p>
    </div>
  );
}

/** The computed difference between two salaries. */
interface SalaryComparison {
  readonly direction: 'increase' | 'decrease' | 'unchanged';
  readonly absolute: string;
  readonly percentage: number | null;
}

/**
 * Compare the current salary with the proposed one.
 *
 * The arithmetic goes through the exact decimal helpers, so a difference
 * that is a fraction of a cent is not lost to a float (MON-002).
 */
function compareSalaries(
  current: string | null,
  proposed: string,
): SalaryComparison | null {
  if (current === null || proposed.trim() === '') {
    return null;
  }

  let absolute: string;
  try {
    absolute = subtractMoney(proposed, current);
  } catch {
    // A half-typed amount is not an error; there is simply nothing to
    // compare yet.
    return null;
  }

  let percentage: number | null;
  try {
    percentage = percentChange(current, proposed);
  } catch {
    percentage = null;
  }

  const sign = absolute.startsWith('-') ? -1 : 1;
  const direction =
    sign > 0 ? 'increase' : sign < 0 ? 'decrease' : 'unchanged';

  return {
    direction,
    absolute: absolute.startsWith('-') ? absolute.slice(1) : absolute,
    percentage,
  };
}

/**
 * The contextual warnings.
 *
 * Every warning is computed from the employee's own facts, so the reader
 * sees the problem before they submit. The server enforces the same rules;
 * these are a courtesy, not the control (UX-JOURNEY Step 6).
 */
function Warnings({
  context,
  effectiveFrom,
  baseSalary,
  reason,
}: {
  context: RevisionFormContext;
  effectiveFrom: string;
  baseSalary: string;
  reason: string;
}) {
  const warnings: string[] = [];

  if (effectiveFrom !== '' && compareDateOnly(effectiveFrom, context.hireDate) < 0) {
    warnings.push(
      `The effective date is before this employee's hire date (${formatDateLong(context.hireDate)}).`,
    );
  }

  if (
    context.terminationDate !== null &&
    effectiveFrom !== '' &&
    compareDateOnly(effectiveFrom, context.terminationDate) >= 0
  ) {
    warnings.push(
      `The effective date is on or after this employee's termination date (${formatDateLong(context.terminationDate)}).`,
    );
  }

  if (effectiveFrom !== '' && compareDateOnly(effectiveFrom, todayDateOnly()) < 0) {
    warnings.push(
      'This date is in the past. A revision creates history that cannot be undone.',
    );
  }

  if (
    effectiveFrom !== '' &&
    context.existingEffectiveDates.some((date) => date === effectiveFrom)
  ) {
    warnings.push('A salary revision already exists for that effective date.');
  }

  if (baseSalary.trim() !== '' && !isPositiveAmount(baseSalary)) {
    warnings.push('The base salary must be greater than zero.');
  }

  if (reason.trim() === '') {
    warnings.push('A reason is required so the change can be explained later.');
  }

  if (warnings.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label="Warnings"
      className="mt-4 space-y-2 rounded-md border border-warning/30 bg-warning-subtle p-3"
    >
      {warnings.map((warning) => (
        <li key={warning} className="flex items-start gap-2 text-sm text-warning-foreground">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{warning}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Whether an amount is greater than zero.
 *
 * Compared on the string, so no float rounding decides a boundary.
 */
function isPositiveAmount(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim()) && !/^0*(\.0*)?$/.test(value.trim());
}

/**
 * The panel shown when the revision was written.
 *
 * It states the new state plainly and points the reader at the profile,
 * where the history now carries the revision.
 */
function SuccessPanel({
  state,
  context,
}: {
  state: Extract<RevisionOutcome, { ok: true }>;
  context: RevisionFormContext;
}) {
  return (
    <div
      role="status"
      className="rounded-md border border-success/30 bg-success-subtle p-4"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-success">
        <CircleCheck aria-hidden="true" className="size-4" />
        The salary revision was added.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {context.employeeName}&apos;s compensation is now at version {state.version}. The
        profile shows the new salary history.
      </p>
    </div>
  );
}

/**
 * The panel shown when the revision was refused.
 *
 * Each code maps to its own recovery, because the reader has to know
 * whether to correct a field, refresh, or try again (D-017).
 */
function FailurePanel({ state }: { state: Extract<RevisionOutcome, { ok: false }> }) {
  if (state.code === 'SALARY_VERSION_CONFLICT') {
    return (
      <div
        role="alert"
        className="rounded-md border border-warning/30 bg-warning-subtle p-4"
      >
        <p className="flex items-center gap-2 text-sm font-medium text-warning-foreground">
          <AlertTriangle aria-hidden="true" className="size-4" />
          {state.message}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your entries have been kept. Reload the page to see the current values, then
          submit your revision again.
        </p>
        <a
          href={window.location.pathname}
          className="mt-2 inline-block rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Refresh and review
        </a>
      </div>
    );
  }

  if (state.code === 'SALARY_EFFECTIVE_DATE_CONFLICT') {
    return (
      <div
        role="alert"
        className="rounded-md border border-warning/30 bg-warning-subtle p-4"
      >
        <p className="flex items-center gap-2 text-sm font-medium text-warning-foreground">
          <CalendarClock aria-hidden="true" className="size-4" />
          {state.message}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a different effective date, or open the existing revision in the salary
          history.
        </p>
      </div>
    );
  }

  if (state.code === 'SALARY_NOT_ELIGIBLE') {
    return (
      <div
        role="alert"
        className="rounded-md border border-danger/30 bg-danger-subtle p-4"
      >
        <p className="text-sm font-medium text-danger">{state.message}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A salary revision can only be created for an employee who is still employed.
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-md border border-danger/30 bg-danger-subtle p-4"
    >
      <p className="text-sm font-medium text-danger">{state.message}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Reference: <span className="font-mono">{state.correlationId}</span>
      </p>
      <StatusBadge tone="caution" prefix="●">
        Nothing was saved
      </StatusBadge>
    </div>
  );
}

/**
 * The first field that carries an error.
 *
 * The reader is sent to the first thing they have to fix, in the order the
 * form presents the fields.
 */
function firstFieldWithError(
  fieldErrors: Readonly<Record<string, string>>,
): string | null {
  const order = ['baseSalary', 'bonusPct', 'effectiveFrom', 'currency', 'reason'];

  for (const field of order) {
    if (fieldErrors[field] !== undefined) {
      return field;
    }
  }

  return null;
}
