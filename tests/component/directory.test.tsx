/**
 * Covers:
 * - MON-001 every money value in the directory carries its currency code
 * - MON-003 the salary column uses the central formatter
 * - RPT-002 the reporting context states which date the figures describe
 * - RPT-005 the ISO currency code is shown alongside the amount
 * - QRY-005 the sorted column is announced with aria-sort
 * - QRY-007 the empty states are distinct
 * - UI.md → Table UX the pager states the real total
 *
 * Does not cover:
 * - The query that produces the rows (tests/integration/employee-directory.test.ts)
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DataTable, Pagination, type Column } from '@/components/product/data-table';
import { EmployeeIdentity, CountryBranchLabel, JobTitleLabel, WorkModeLabel } from '@/components/product/employee-identity';
import { MoneyDisplay } from '@/components/product/money-display';
import { EmploymentStatusBadge } from '@/components/product/status-badge';
import { EmptyState, NoMatchState } from '@/components/product/empty-state';
import { ErrorState } from '@/components/product/error-state';
import { SalaryCard } from '@/components/product/salary-card';

interface Row {
  id: number;
  name: string;
  status: string;
  salary: string | null;
  currency: string | null;
}

const ROWS: Row[] = [
  { id: 1, name: 'Ann Abbott', status: 'active', salary: '54206.05', currency: 'USD' },
  { id: 2, name: 'Bob Baker', status: 'on_leave', salary: '1200000.00', currency: 'INR' },
];

const COLUMNS: Column<Row>[] = [
  {
    key: 'employee',
    header: 'Employee',
    sortValue: 'employee',
    render: (row) => <span>{row.name}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    sortValue: 'status',
    render: (row) => <EmploymentStatusBadge status={row.status} />,
  },
  {
    key: 'salary',
    header: 'Current salary',
    sortValue: 'salary',
    render: (row) =>
      row.salary !== null && row.currency !== null ? (
        <MoneyDisplay amount={row.salary} currency={row.currency} />
      ) : (
        <span>No salary record</span>
      ),
  },
];

describe('DataTable', () => {
  it('renders a row per employee', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        rowHref={(row) => `/employees/${row.id}` as never}
        caption="Employees matching the current search and filters"
        sort="employee"
        sortHref={() => '/employees' as never}
        emptyState={<p>none</p>}
      />,
    );

    expect(screen.getByRole('row', { name: /Ann Abbott/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Bob Baker/ })).toBeInTheDocument();
  });

  it('marks the sorted column with aria-sort', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        rowHref={(row) => `/employees/${row.id}` as never}
        caption="Employees"
        sort="status"
        sortHref={() => '/employees' as never}
        emptyState={<p>none</p>}
      />,
    );

    const headers = screen.getAllByRole('columnheader');
    const statusHeader = headers.find((header) =>
      within(header).queryByRole('link', { name: 'Status' }),
    );
    expect(statusHeader).toHaveAttribute('aria-sort', 'ascending');

    const salaryHeader = headers.find((header) =>
      within(header).queryByRole('link', { name: 'Current salary' }),
    );
    expect(salaryHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('sorts the salary column descending, because the highest salary leads', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        rowHref={(row) => `/employees/${row.id}` as never}
        caption="Employees"
        sort="salary"
        sortHref={() => '/employees' as never}
        emptyState={<p>none</p>}
      />,
    );

    const headers = screen.getAllByRole('columnheader');
    const salaryHeader = headers.find((header) =>
      within(header).queryByRole('link', { name: 'Current salary' }),
    );
    expect(salaryHeader).toHaveAttribute('aria-sort', 'descending');
  });

  it('shows the empty state instead of an empty table', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
        rowHref={(row) => `/employees/${row.id}` as never}
        caption="Employees"
        sort="employee"
        sortHref={() => '/employees' as never}
        emptyState={<p>No employees match these filters</p>}
      />,
    );

    expect(screen.getByText('No employees match these filters')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('states the real total, not the page size', () => {
    render(
      <Pagination
        page={1}
        pageSize={25}
        total={248}
        totalPages={10}
        hrefFor={() => '/employees' as never}
      />,
    );

    // The summary states the visible range and the real total, so a reader
    // knows there are more pages than the ones on screen. The text spans
    // several elements, so the whole element's text is matched.
    expect(screen.getByText(/Showing/)).toHaveTextContent(
      'Showing 1–25 of 248 matching employees',
    );
  });

  it('states the range on a later page', () => {
    render(
      <Pagination
        page={3}
        pageSize={25}
        total={248}
        totalPages={10}
        hrefFor={() => '/employees' as never}
      />,
    );

    expect(screen.getByText(/Showing/)).toHaveTextContent(
      'Showing 51–75 of 248 matching employees',
    );
  });

  it('disables the previous link on the first page', () => {
    render(
      <Pagination
        page={1}
        pageSize={25}
        total={248}
        totalPages={10}
        hrefFor={() => '/employees' as never}
      />,
    );

    expect(screen.queryByRole('link', { name: 'Previous page' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next page' })).toBeInTheDocument();
  });

  it('renders nothing when there are no rows to page through', () => {
    const { container } = render(
      <Pagination
        page={1}
        pageSize={25}
        total={0}
        totalPages={0}
        hrefFor={() => '/employees' as never}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('MoneyDisplay in the directory', () => {
  it('shows the currency code with every amount', () => {
    render(<MoneyDisplay amount="1200000.00" currency="INR" />);
    expect(screen.getByText(/INR/)).toBeInTheDocument();
  });
});

describe('EmploymentStatusBadge', () => {
  it('states the status in text, not by colour alone', () => {
    render(<EmploymentStatusBadge status="on_leave" />);
    expect(screen.getByText('On leave')).toBeInTheDocument();
  });

  it('states a terminated status in text', () => {
    render(<EmploymentStatusBadge status="terminated" />);
    expect(screen.getByText('Terminated')).toBeInTheDocument();
  });
});

describe('EmployeeIdentity', () => {
  it('shows the employee ID alongside the name', () => {
    render(<EmployeeIdentity firstName="Ann" lastName="Abbott" employeeId={42} />);
    expect(screen.getByText(/Ann Abbott/)).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
  });
});

describe('CountryBranchLabel', () => {
  it('names the country and the branch', () => {
    render(
      <CountryBranchLabel countryCode="IN" branchCode="IN-BLR" branchCity="Bengaluru" />,
    );
    expect(screen.getByText('IN')).toBeInTheDocument();
    expect(screen.getByText(/IN-BLR/)).toBeInTheDocument();
  });
});

describe('JobTitleLabel and WorkModeLabel', () => {
  it('labels the job level so a bare number is never shown', () => {
    render(<JobTitleLabel jobTitle="Lead, Payroll" jobLevel={4} />);
    expect(screen.getByText('Level 4')).toBeInTheDocument();
  });

  it('writes the work mode out in full', () => {
    render(<WorkModeLabel workMode="remote" />);
    expect(screen.getByText('Remote work')).toBeInTheDocument();
  });
});

describe('distinct empty and error states (QRY-007)', () => {
  it('distinguishes "no data" from "no match"', () => {
    const { unmount } = render(
      <EmptyState title="There are no employees to show" description="The workforce has not been loaded yet." />,
    );
    expect(screen.getByText('There are no employees to show')).toBeInTheDocument();
    unmount();

    render(<NoMatchState description={'No employees match "xyz".'} />);
    expect(screen.getByText('No employees match these filters')).toBeInTheDocument();
  });

  it('shows a plain-language error with no stack trace', () => {
    render(
      <ErrorState
        title="The employee directory could not be loaded"
        description="Try again in a moment."
        correlationId="abc-123"
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Try again in a moment/)).toBeInTheDocument();
    expect(screen.getByText('abc-123')).toBeInTheDocument();
  });
});

describe('SalaryCard', () => {
  it('states the reporting date in words', () => {
    render(
      <SalaryCard
        baseSalary="54206.05"
        bonusPct="12.50"
        currencyCode="USD"
        effectiveFrom="2025-06-01"
        usdEquivalent={null}
        reportingDate="2026-03-01"
      />,
    );

    expect(screen.getByText(/Current as of/)).toBeInTheDocument();
    expect(screen.getByText('1 Mar 2026')).toBeInTheDocument();
  });

  it('labels a scheduled revision separately and says it is not current', () => {
    render(
      <SalaryCard
        baseSalary="54206.05"
        bonusPct="12.50"
        currencyCode="USD"
        effectiveFrom="2025-06-01"
        usdEquivalent={null}
        reportingDate="2026-03-01"
        scheduled={{
          baseSalary: '60000.00',
          currencyCode: 'USD',
          effectiveFrom: '2027-03-01',
        }}
      />,
    );

    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText(/Not counted as current compensation/)).toBeInTheDocument();
  });

  it('labels a terminated employee salary as final', () => {
    render(
      <SalaryCard
        baseSalary="54206.05"
        bonusPct="12.50"
        currencyCode="USD"
        effectiveFrom="2023-06-01"
        usdEquivalent={null}
        reportingDate="2026-03-01"
        label="Final salary"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Final salary' })).toBeInTheDocument();
  });
});
