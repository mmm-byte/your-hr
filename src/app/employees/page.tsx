import type { Metadata } from 'next';
import type { Route } from 'next';
import { Suspense } from 'react';
import { SearchX } from 'lucide-react';
import { getDatabase } from '@/db/client';
import { queryEmployeeDirectory } from '@/db/queries/employees';
import { parseEmployeeDirectoryQuery } from '@/schemas/employee-directory';
import { todayDateOnly } from '@/lib/date-only';
import { buildQueryString, hasActiveFilter, readQueryState } from '@/lib/url-state';
import { BRANCH_CODES } from '@/lib/domain-values';
import { DataTable, Pagination, type Column } from '@/components/product/data-table';
import { EmptyState, NoMatchState } from '@/components/product/empty-state';
import { FilterBar } from '@/components/product/filter-bar';
import { EmployeeIdentity, CountryBranchLabel, JobTitleLabel, WorkModeLabel } from '@/components/product/employee-identity';
import { MoneyDisplay } from '@/components/product/money-display';
import { PageHeader } from '@/components/product/page-header';
import { ReportingDatePicker } from '@/components/product/reporting-date-picker';
import { EmploymentStatusBadge } from '@/components/product/status-badge';
import type { DirectoryRow } from '@/db/queries/employees';

export const metadata: Metadata = {
  title: 'Employees',
};

/**
 * The employee directory (UX-JOURNEY.md §3).
 *
 * A **server component**: the search, filters, sort, and page all live in the
 * URL, so the server reads them and returns one bounded page of rows. The
 * browser never receives the 10,000-person workforce (ANA-007).
 *
 * The reporting date is read here too, because the current salary on each row
 * depends on it (RPT-001). It travels in the URL as `?asOf=YYYY-MM-DD`
 * (RPT-003), so a shared link reproduces the same view.
 */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const state = readQueryState(raw);
  const query = parseEmployeeDirectoryQuery(raw);

  // A query that is not an object at all is the only failure case; every
  // individual field degrades to its documented default.
  if (query === null) {
    return <DirectoryUnavailable />;
  }

  const reportingDate = query.asOf ?? todayDateOnly();
  const db = getDatabase();
  const result = await queryEmployeeDirectory(db, query);

  return (
    <>
      <PageHeader
        title="Employees"
        description="Search and filter the workforce, then open a profile to review compensation history."
        context={`As of ${reportingDate}`}
        actions={
          <Suspense fallback={null}>
            <ReportingDatePicker value={reportingDate} max={todayDateOnly()} />
          </Suspense>
        }
      />

      <div className="space-y-5">
        <Suspense fallback={null}>
          <FilterBar branchesByCountry={BRANCHES_BY_COUNTRY} />
        </Suspense>

        {result.rows.length > 0 ? (
          <>
            <EmployeeTable result={result} state={state} sort={query.sort} />
            <Pagination
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              totalPages={result.totalPages}
              hrefFor={(page) =>
                directoryHref(buildQueryString({ ...state, page: String(page) }))
              }
            />
          </>
        ) : (
          <DirectoryEmptyState
            isEmptyPopulation={result.isEmptyPopulation}
            state={state}
          />
        )}
      </div>
    </>
  );
}

/**
 * The directory table.
 *
 * The columns follow the directory contract in the order a reader scans them:
 * identity first, then the attributes that decide whether to open the row.
 */
function EmployeeTable({
  result,
  state,
  sort,
}: {
  result: Awaited<ReturnType<typeof queryEmployeeDirectory>>;
  state: Readonly<Record<string, string | undefined>>;
  sort: string;
}) {
  const columns: Column<DirectoryRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sortValue: 'employee',
      render: (row) => (
        <EmployeeIdentity
          firstName={row.firstName}
          lastName={row.lastName}
          employeeId={row.id}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: 'status',
      render: (row) => <EmploymentStatusBadge status={row.employmentStatus} />,
    },
    {
      key: 'jobTitle',
      header: 'Job title',
      sortValue: 'jobTitle',
      render: (row) => (
        <JobTitleLabel jobTitle={row.jobTitle} jobLevel={row.jobLevel} />
      ),
    },
    {
      key: 'location',
      header: 'Country / Branch',
      sortValue: 'country',
      secondary: true,
      render: (row) => (
        <CountryBranchLabel
          countryCode={row.countryCode}
          branchCode={row.branchCode}
          branchCity={row.branchCity}
        />
      ),
    },
    {
      key: 'salary',
      header: 'Current salary',
      sortValue: 'salary',
      render: (row) =>
        row.currentBaseSalary !== null && row.currentCurrencyCode !== null ? (
          <MoneyDisplay
            amount={row.currentBaseSalary}
            currency={row.currentCurrencyCode}
          />
        ) : (
          <span className="text-muted-foreground">No salary record</span>
        ),
    },
    {
      key: 'workMode',
      header: 'Work mode',
      sortValue: 'workMode',
      secondary: true,
      render: (row) => <WorkModeLabel workMode={row.workMode} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={result.rows}
      rowKey={(row) => row.id}
      rowHref={(row) => `/employees/${row.id}` as Route}
      caption="Employees matching the current search and filters"
      sort={sort}
      sortHref={(sortValue) =>
        directoryHref(buildQueryString({ ...state, sort: sortValue, page: '1' }))
      }
      emptyState={
        <EmptyState
          title="No employees match these filters"
          description="Try clearing a filter or searching for a different name."
        />
      }
    />
  );
}

/**
 * The empty state.
 *
 * The three cases are deliberately distinct: there is no data, the search
 * matched nothing, or the filter combination is too narrow (QRY-007). A user
 * must never have to guess whether the system is broken or the filter is.
 */
function DirectoryEmptyState({
  isEmptyPopulation,
  state,
}: {
  isEmptyPopulation: boolean;
  state: Readonly<Record<string, string | undefined>>;
}) {
  if (isEmptyPopulation) {
    return (
      <EmptyState
        title="There are no employees to show"
        description="The workforce has not been loaded yet. Run the seed to populate the directory."
      />
    );
  }

  if (state.search !== undefined && state.search !== '') {
    return (
      <NoMatchState
        description={`No employees match "${state.search}". Try an employee ID, a full name, or an email address.`}
        action={<ClearFiltersLink state={state} />}
      />
    );
  }

  if (hasActiveFilter(state)) {
    return (
      <NoMatchState
        description="No employees match the filters you have applied. Clear a filter to widen the search."
        action={<ClearFiltersLink state={state} />}
      />
    );
  }

  return (
    <EmptyState
      title="There are no employees to show"
      description="The workforce has not been loaded yet."
    />
  );
}

/**
 * A link that clears every filter but keeps the reporting date.
 *
 * A link rather than a button, so it is focusable, keyboard-accessible, and
 * shows its destination.
 */
function ClearFiltersLink({
  state,
}: {
  state: Readonly<Record<string, string | undefined>>;
}) {
  const query = buildQueryString({
    asOf: state.asOf,
    sort: state.sort,
  });

  return (
    <a
      href={directoryHref(query)}
      className="inline-flex rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      Clear filters
    </a>
  );
}

/**
 * Shown when the query string is not a query object at all.
 *
 * This is a defensive branch, not a routine state: the boundary schema
 * accepts every field's degradation, so reaching here means something
 * structurally wrong was passed.
 */
function DirectoryUnavailable() {
  return (
    <EmptyState
      icon={<SearchX aria-hidden="true" className="size-5" />}
      title="The directory could not be read"
      description="The request was not a valid query. Return to the directory to start again."
    />
  );
}

/**
 * Build a link to the directory, preserving the typed-route guarantee.
 *
 * The query string is assembled at runtime, so it cannot be a literal the
 * route type checker can see. The cast is confined to this one function so
 * the rest of the page keeps its route types.
 */
function directoryHref(query: string): Route {
  return (query === '' ? '/employees' : `/employees${query}`) as Route;
}

/**
 * The branch codes in each country.
 *
 * The branch filter is dependent: choosing a country narrows the branch
 * options to that country's branches (UX-JOURNEY §3). The mapping is derived
 * from the seeded branch codes rather than hard-coded twice.
 */
const BRANCHES_BY_COUNTRY: Readonly<Record<string, readonly string[]>> = {
  US: BRANCH_CODES.filter((code) => code.startsWith('US-')),
  IN: BRANCH_CODES.filter((code) => code.startsWith('IN-')),
  GB: BRANCH_CODES.filter((code) => code.startsWith('GB-')),
  DE: BRANCH_CODES.filter((code) => code.startsWith('DE-')),
  CA: BRANCH_CODES.filter((code) => code.startsWith('CA-')),
  AU: BRANCH_CODES.filter((code) => code.startsWith('AU-')),
};
