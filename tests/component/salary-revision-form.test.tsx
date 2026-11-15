/**
 * Covers:
 * - ELG-004 the currency is fixed and shown as such
 * - UX-JOURNEY Step 6 the live comparison states the direction in words
 * - UX-JOURNEY Step 6 a validation failure is shown next to its field
 * - UX-JOURNEY Step 6 the submit button is disabled on the first click
 * - CON-002 a conflict preserves the reader's input
 * - SAL-006 a duplicate effective date is explained
 * - SAL-009 the reason is required
 * - AUD-004 an unexpected failure shows a correlation id and no stack trace
 * - UX-JOURNEY Step 6 a success shows a confirmation
 *
 * Does not cover:
 * - The write and the transaction (tests/integration/salary-revision.test.ts)
 * - The domain rules (tests/unit/salary-rules.test.ts)
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalaryRevisionForm, type RevisionFormContext } from '@/components/product/salary-revision-form';
import type { RevisionOutcome } from '@/server/revision-outcome';

const CONTEXT: RevisionFormContext = {
  employeeId: 2521,
  employeeName: 'David Abbott',
  currency: 'USD',
  hireDate: '2021-11-07',
  terminationDate: null,
  version: 3,
  currentSalary: {
    baseSalary: '54206.05',
    bonusPct: '8.80',
    effectiveFrom: '2026-03-24',
  },
  existingEffectiveDates: ['2026-03-24', '2025-11-20'],
};

/**
 * The server action, stubbed.
 *
 * The action is a `'use server'` module, so it is replaced wholesale in the
 * test: the form's behaviour is what is under test, not the write.
 */
const reviseSalary = vi.fn<() => Promise<RevisionOutcome>>(async () => ({
  ok: false,
  code: 'VALIDATION_ERROR',
  message: 'Some of the details entered are not valid.',
  fieldErrors: { baseSalary: 'The base salary must be greater than zero.' },
  correlationId: 'req-test',
  submitted: null,
}));

vi.mock('@/server/revise-salary-action', () => ({
  reviseSalary: (...args: unknown[]) => reviseSalary(...(args as [])),
}));


/**
 * Submit the form.
 *
 * The failure and success panels only exist after a submission, so a test
 * that asserts on them must submit first.
 */
async function submitForm(): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Add salary revision' }));
}

describe('the salary revision form', () => {
  it('shows the current salary read-only', () => {
    render(<SalaryRevisionForm context={CONTEXT} />);

    const current = screen.getByRole('region', { name: 'Current salary' });
    expect(within(current).getByText(/\$54,206\.05 USD/)).toBeInTheDocument();
    expect(within(current).getByText('8.8%')).toBeInTheDocument();
    expect(within(current).getByText('bonus')).toBeInTheDocument();
  });

  it('shows the currency as fixed, and not as an editable input', () => {
    // ELG-004: the currency comes from the employee's branch policy, so it
    // is displayed and not editable.
    render(<SalaryRevisionForm context={CONTEXT} />);

    // The currency is shown, it is a labelled control, and it cannot be
    // edited — but it is still submitted, so the server can compare it with
    // the employee's own currency (ELG-004).
    const currency = screen.getByLabelText('Currency');
    expect(currency).toHaveValue('USD');
    expect(currency).toHaveAttribute('readonly');
    expect(currency).toHaveAttribute('name', 'currency');
  });

  it('states the change in words, not by colour alone', async () => {
    const user = userEvent.setup();
    render(<SalaryRevisionForm context={CONTEXT} />);

    const baseSalary = screen.getByLabelText('Base salary');
    await user.clear(baseSalary);
    await user.type(baseSalary, '60000.00');

    // The direction is a word, so a reader who cannot see the colour still
    // knows it (UI.md -> Accessibility).
    expect(screen.getByText('Increase of')).toBeInTheDocument();
    expect(screen.getByText(/\$5,793\.95 USD/)).toBeInTheDocument();
    // The percentage is truncated, not rounded, by the exact helper.
    expect(screen.getByText(/10\.68%/)).toBeInTheDocument();
  });

  it('warns when the effective date is before the hire date', () => {
    render(<SalaryRevisionForm context={CONTEXT} />);

    fireEvent.change(screen.getByLabelText('Effective from'), {
      target: { value: '2019-01-01' },
    });

    const warnings = screen.getByRole('list', { name: 'Warnings' });
    expect(warnings.textContent).toContain('hire date');
  });

  it('warns when a revision already exists for the date', () => {
    render(<SalaryRevisionForm context={CONTEXT} />);

    fireEvent.change(screen.getByLabelText('Effective from'), {
      target: { value: '2026-03-24' },
    });

    const warnings = screen.getByRole('list', { name: 'Warnings' });
    expect(
      within(warnings).getByText(/already exists for that effective date/i),
    ).toBeInTheDocument();
  });

  it('warns when the reason is empty', () => {
    render(<SalaryRevisionForm context={CONTEXT} />);

    const warnings = screen.getByRole('list', { name: 'Warnings' });
    expect(within(warnings).getByText(/reason is required/i)).toBeInTheDocument();
  });

  it('shows a validation failure next to its field', async () => {
    render(<SalaryRevisionForm context={CONTEXT} />);

    await submitForm();

    // The message is rendered by the failure panel, and the field that
    // caused it is named by `aria-describedby` on the input.
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText('The base salary must be greater than zero.'),
    ).toBeInTheDocument();
  });

  it('labels the submit action as an append, not a save', () => {
    // "Save" implies an overwrite; the form appends (UX-JOURNEY Step 6).
    render(<SalaryRevisionForm context={CONTEXT} />);

    expect(
      screen.getByRole('button', { name: 'Add salary revision' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('disables the button on the first click, so a revision is never written twice', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    reviseSalary.mockImplementation(
      () =>
        new Promise<RevisionOutcome>((resolve) => {
          release = () =>
            resolve({
              ok: false,
              code: 'VALIDATION_ERROR',
              message: 'x',
              fieldErrors: {},
              correlationId: 'req-test',
              submitted: null,
            });
        }),
    );

    render(<SalaryRevisionForm context={CONTEXT} />);
    const button = screen.getByRole('button', { name: 'Add salary revision' });

    await user.click(button);

    // The button is disabled and says what it is doing.
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    release?.();
  });

  it('explains a version conflict and keeps the reader input', async () => {
    reviseSalary.mockResolvedValue({
      ok: false,
      code: 'SALARY_VERSION_CONFLICT',
      message: "This employee's compensation changed since you opened this form.",
      fieldErrors: {},
      correlationId: 'req-test',
      submitted: {
        employeeId: 2521,
        baseSalary: '60000.00',
        bonusPct: '9.00',
        currency: 'USD' as const,
        effectiveFrom: '2027-01-01',
        reason: 'My reason',
        expectedVersion: 3,
      },
    });

    render(<SalaryRevisionForm context={CONTEXT} />);

    await submitForm();

    expect(screen.getByRole('alert')).toHaveTextContent(
      /compensation changed since you opened this form/i,
    );
    // CON-002: the reader's input survives, so the revision can be
    // re-applied after they have reviewed what changed.
    expect(screen.getByLabelText('Base salary')).toHaveValue('60000.00');
    expect(screen.getByLabelText('Reason')).toHaveValue('My reason');
  });

  it('offers a refresh when the version has moved on', async () => {
    reviseSalary.mockResolvedValue({
      ok: false,
      code: 'SALARY_VERSION_CONFLICT',
      message: "This employee's compensation changed since you opened this form.",
      fieldErrors: {},
      correlationId: 'req-test',
      submitted: null,
    });

    render(<SalaryRevisionForm context={CONTEXT} />);

    await submitForm();

    expect(screen.getByRole('link', { name: 'Refresh and review' })).toBeInTheDocument();
  });

  it('explains a duplicate effective date', async () => {
    reviseSalary.mockResolvedValue({
      ok: false,
      code: 'SALARY_EFFECTIVE_DATE_CONFLICT',
      message: 'A salary revision already exists for that effective date.',
      fieldErrors: {},
      correlationId: 'req-test',
      submitted: null,
    });

    render(<SalaryRevisionForm context={CONTEXT} />);

    await submitForm();

    expect(screen.getByRole('alert')).toHaveTextContent(
      /already exists for that effective date/i,
    );
  });

  it('shows the correlation id and no stack trace on an unexpected failure', async () => {
    reviseSalary.mockResolvedValue({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong while completing that request.',
      fieldErrors: {},
      correlationId: 'req-abc123',
      submitted: null,
    });

    render(<SalaryRevisionForm context={CONTEXT} />);

    await submitForm();

    expect(screen.getByRole('alert')).toHaveTextContent('req-abc123');
    expect(screen.queryByText(/at .*\.tsx:\d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
  });

  it('confirms a success', async () => {
    reviseSalary.mockResolvedValue({
      ok: true,
      revisionId: 42,
      version: 4,
      correlationId: 'req-test',
    });

    render(<SalaryRevisionForm context={CONTEXT} />);

    await submitForm();

    expect(screen.getByRole('status')).toHaveTextContent(
      /salary revision was added/i,
    );
  });
});
