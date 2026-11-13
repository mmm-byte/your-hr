/**
 * Covers:
 * - AUD-004 a failed load explains itself in plain language
 * - AUD-004 the raw database message never reaches the reader
 * - QRY-004 an error offers a recovery action
 *
 * Does not cover:
 * - The query that failed (tests/integration/employee-directory.test.ts)
 * - The server log the detail is written to
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmployeesError from '@/app/employees/error';
import EmployeeError from '@/app/employees/[employeeId]/error';

describe('the directory error boundary', () => {
  it('explains the failure in plain language', () => {
    render(
      <EmployeesError error={new Error('boom')} reset={() => {}} />,
    );

    expect(
      screen.getByText('The employee directory could not be loaded'),
    ).toBeInTheDocument();
  });

  it('never renders the raw database message', () => {
    const raw = 'relation "salary_records" does not exist';
    render(
      <EmployeesError error={new Error(raw)} reset={() => {}} />,
    );

    expect(screen.queryByText(/relation "salary_records"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/does not exist/)).not.toBeInTheDocument();
  });

  it('offers a way to try again', () => {
    const reset = vi.fn();
    render(<EmployeesError error={new Error('boom')} reset={reset} />);

    const button = screen.getByRole('button');
    button.click();
    expect(reset).toHaveBeenCalled();
  });
});

describe('the profile error boundary', () => {
  it('explains the failure in plain language', () => {
    render(<EmployeeError error={new Error('boom')} reset={() => {}} />);

    expect(
      screen.getByText(/could not be loaded/i),
    ).toBeInTheDocument();
  });

  it('never renders the raw database message', () => {
    render(
      <EmployeeError
        error={new Error('duplicate key value violates unique constraint')}
        reset={() => {}}
      />,
    );

    expect(screen.queryByText(/unique constraint/)).not.toBeInTheDocument();
  });
});
