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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DataTable, Pagination, type Column } from '@/components/product/data-table';
import { PageSizeSelect } from '@/components/product/page-size-select';
import { EmployeeIdentity, CountryBranchLabel, JobTitleLabel, WorkModeLabel } from '@/components/product/employee-identity';
import { MoneyDisplay } from '@/components/product/money-display';
import { EmploymentStatusBadge } from '@/components/product/status-badge';
import { EmptyState, NoMatchState } from '@/components/product/empty-state';
import { EMPLOYMENT_STATUS_LABELS } from '@/lib/domain-values';
import { navigations } from '../setup/component';
import { ErrorState } from '@/components/product/error-state';
import { SalaryCard } from '@/components/product/salary-card';

interface Row {
  id: number;
  name: string;
  status: string;
  salary: string | null;
  currency: string | null;
  workMode: string;
}

const ROWS: Row[] = [
  {
    id: 1,
    name: 'Ann Abbott',
    status: 'active',
    salary: '54206.05',
    currency: 'USD',
    workMode: 'Hybrid',
  },
  {
    id: 2,
    name: 'Bob Baker',
    status: 'on_leave',
    salary: '1200000.00',
    currency: 'INR',
    workMode: 'Remote',
  },
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

const COLUMNS_WITH_SECONDARY: Column<Row>[] = [
  ...COLUMNS,
  {
    key: 'workMode',
    header: 'Work mode',
    sortValue: 'workMode',
    secondary: true,
    render: (row) => <span>{row.workMode}</span>,
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

  it('moves the secondary attributes into the row details on a narrow screen', () => {
    // UI.md -> Responsive priority: the secondary attributes must be moved
    // into row details rather than dropped, so nothing the table knows is
    // lost when the column disappears.
    render(
      <DataTable
        columns={COLUMNS_WITH_SECONDARY}
        rows={ROWS}
        rowKey={(row) => row.id}
        rowHref={(row) => `/employees/${row.id}` as never}
        caption="Employees"
        sort="employee"
        sortHref={() => '/employees' as never}
        emptyState={<p>none</p>}
      />,
    );

    const details = screen.getByTestId('row-details-1');
    expect(within(details).getByText('Work mode')).toBeInTheDocument();
    expect(within(details).getByText('Hybrid')).toBeInTheDocument();
  });

  it('keeps the row details out of the wide layout', () => {
    // The block carries `md:hidden`, so it is only present on a narrow
    // screen. Asserting the class keeps the two layouts from double-printing
    // the same value.
    render(
      <DataTable
        columns={COLUMNS_WITH_SECONDARY}
        rows={ROWS}
        rowKey={(row) => row.id}
        rowHref={(row) => `/employees/${row.id}` as never}
        caption="Employees"
        sort="employee"
        sortHref={() => '/employees' as never}
        emptyState={<p>none</p>}
      />,
    );

    expect(screen.getByTestId('row-details-1').className).toContain('md:hidden');
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

describe('PageSizeSelect', () => {
  it('offers the documented page sizes', () => {
    // UX-JOURNEY Step 3 requires a page-size selector. The sizes are the
    // schema's default and its maximum.
    render(
      <PageSizeSelect pageSize={25} options={[25, 50, 100]} />,
    );

    const select = screen.getByLabelText('Rows per page');
    expect(select).toHaveValue('25');
    expect(
      within(select).getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['25', '50', '100']);
  });

  it('puts the chosen size in the URL and returns to page 1', () => {
    // The size is part of the directory's URL state, so a shared link
    // reproduces the same view, and the page resets because a page number
    // is only meaningful relative to the size that produced it (QRY-006).
    render(<PageSizeSelect pageSize={25} options={[25, 50, 100]} />);

    fireEvent.change(screen.getByLabelText('Rows per page'), {
      target: { value: '50' },
    });

    expect(navigations).toHaveLength(1);
    expect(navigations[0]?.href).toContain('pageSize=50');
    expect(navigations[0]?.href).toContain('page=1');

    // `replace`, not `push`: changing a filter rewrites the current view
    // rather than adding a history entry, so the back button returns to the
    // previous page rather than through every filter the reader tried.
    expect(navigations[0]?.method).toBe('replace');
  });
});

describe('Pagination on a page beyond the last one', () => {
  it('states the total without a range that runs past it', () => {
    // QRY-004: a page beyond the last page returns an empty result with a
    // safe navigation affordance. A range like "25,001-25,000 of 10,000"
    // would read as a mistake, so only the total is stated.
    render(
      <Pagination
        page={999}
        pageSize={25}
        total={10_000}
        totalPages={400}
        hrefFor={(page) => `/employees?page=${page}` as never}
      />,
    );

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav.textContent).toContain('10,000 matching employees');
    expect(nav.textContent).toContain('no results on this page');
    expect(nav.textContent).not.toContain('25,001');
    expect(nav.textContent).not.toContain('25,000');
  });

  it('offers a way back to a page that has results', () => {
    render(
      <Pagination
        page={999}
        pageSize={25}
        total={10_000}
        totalPages={400}
        hrefFor={(page) => `/employees?page=${page}` as never}
      />,
    );

    // The back link jumps to the last page that actually has results, not to
    // page 998, which is also empty.
    expect(screen.getByRole('link', { name: 'Last page with results' })).toHaveAttribute(
      'href',
      '/employees?page=400',
    );
    expect(screen.queryByRole('link', { name: 'Next page' })).not.toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav.textContent).toContain('beyond the last page');
    expect(nav.textContent).not.toContain('999 of 400');
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

  it('names every status the way the filter dropdown does', () => {
    // The labels live in one shared map, so the dropdown and the badge cannot
    // call the same value by two different names.
    for (const [value, label] of Object.entries(EMPLOYMENT_STATUS_LABELS)) {
      const { unmount } = render(<EmploymentStatusBadge status={value} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
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
    expect(screen.getByText('Remote')).toBeInTheDocument();
  });

  it('names a work mode the same way the filter dropdown does', () => {
    // The label comes from one shared map, so the table and the dropdown
    // cannot call the same value by two different names.
    render(<WorkModeLabel workMode="office" />);
    expect(screen.getByText('On site')).toBeInTheDocument();
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
