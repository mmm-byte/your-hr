import type { Metadata } from 'next';
import type { Route } from 'next';
import { Suspense } from 'react';
import { getDatabase } from '@/db/client';
import {
  queryCompensationPopulation,
  queryCurrencyAggregates,
} from '@/db/queries/compensation';
import { parseEmployeeDirectoryQuery } from '@/schemas/employee-directory';
import { formatDateLong, todayDateOnly } from '@/lib/date-only';
import { formatCount } from '@/lib/money';
import { buildQueryString, readQueryState, readReportingDate } from '@/lib/url-state';
import { BRANCHES_BY_COUNTRY } from '@/lib/domain-values';
import { AggregatePanel } from '@/components/product/aggregate-panel';
import { DataTable, Pagination, type Column } from '@/components/product/data-table';
import { EmptyState, NoMatchState } from '@/components/product/empty-state';
import { FilterBar } from '@/components/product/filter-bar';
import { EmployeeIdentity, CountryBranchLabel, JobTitleLabel } from '@/components/product/employee-identity';
import { MoneyDisplay } from '@/components/product/money-display';
import { PageHeader } from '@/components/product/page-header';
import { ReportingDatePicker } from '@/components/product/reporting-date-picker';
import { EmploymentStatusBadge } from '@/components/product/status-badge';
import type { CompensationPopulationRow } from '@/db/queries/compensation';

export const metadata: Metadata = {
  title: 'Compensation',
};
/**
 * This page reads the database at request time.
 *
 * The build must never need a database, so the page is rendered on demand
 * rather than prerendered (the CI job sets no `DATABASE_URL` and must still
 * build — ENVIRONMENT.md → Build).
 */
export const dynamic = 'force-dynamic';


/**
 * The compensation view (UX-JOURNEY.md §5, Phase 5 item 5.1 and 5.2).
 *
 * A **server component**: the filters and the reporting date live in the URL,
 * so the server reads them and returns one bounded page of rows plus the
 * aggregates for the current selection (ANA-007).
 *
 * The one rule this page exists to enforce:
 *
 * - **There is no mixed-currency total anywhere on this page.** The
 *   aggregates are grouped by currency, so each figure states the currency it
 *   is in (MON-004, ANA-005, RPT-007). A reader who wants a single number
 *   asks for the USD-equivalent view, which is a separate, clearly labelled
 *   mode built on the synthetic reference rate (MON-005, MON-006).
 *
 * The USD-equivalent view is opt-in through the `equivalent=usd` query
 * parameter, so a reader never sees a local amount and an equivalent side by
 * side without knowing which is which.
 */
export default async function CompensationPage({
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
    return <CompensationUnavailable />;
  }

  const reportingDate = readReportingDate(state, todayDateOnly());
  const showUsdEquivalent = state.equivalent === 'usd';

  const db = getDatabase();
  const [population, aggregates] = await Promise.all([
    queryCompensationPopulation(db, query),
    queryCurrencyAggregates(db, { ...query, asOf: reportingDate }),
  ]);

  return (
    <>
      <PageHeader
        title="Compensation"
        description="The current salary population and its aggregates, grouped by currency."
        context={`As of ${formatDateLong(reportingDate)}`}
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

        <AggregatePanel
          figures={showUsdEquivalent ? aggregates.byUsdEquivalent : aggregates.byCurrency}
          heading={showUsdEquivalent ? 'Aggregates (synthetic USD equivalent)' : 'Aggregates by currency'}
          description={
            showUsdEquivalent
              ? 'Each block describes the population of one currency, expressed in the synthetic USD equivalent.'
              : 'Each block is one currency. Figures are never added across currencies.'
          }
          usdEquivalent={showUsdEquivalent}
        />

        {population.rows.length > 0 ? (
          <>
            <CompensationTable population={population} state={state} />
            <Pagination
              page={population.page}
              pageSize={population.pageSize}
              total={population.total}
              totalPages={population.totalPages}
              hrefFor={(page) =>
                compensationHref(buildQueryString({ ...state, page: String(page) }))
              }
              showPageSize
            />
          </>
        ) : population.total > 0 ? (
          <>
            <EmptyState
              title={`Page ${population.page} is past the end of the results`}
              description={`${formatCount(population.total)} employees match your filters. Use the pager to go back to a page with results.`}
            />
            <Pagination
              page={population.page}
              pageSize={population.pageSize}
              total={population.total}
              totalPages={population.totalPages}
              hrefFor={(page) =>
                compensationHref(buildQueryString({ ...state, page: String(page) }))
              }
              showPageSize
            />
          </>
        ) : (
          <CompensationEmptyState isEmptyPopulation={population.isEmptyPopulation} state={state} />
        )}
      </div>
    </>
  );
}

/**
 * The compensation table.
 *
 * The columns follow the directory's priority order, so a reader who knows
 * the directory recognises this table immediately (UI.md → Responsive
 * priority).
 */
function CompensationTable({
  population,
  state,
}: {
  population: Awaited<ReturnType<typeof queryCompensationPopulation>>;
  state: Readonly<Record<string, string | undefined>>;
}) {
  const columns: Column<CompensationPopulationRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
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
      render: (row) => <EmploymentStatusBadge status={row.employmentStatus} />,
    },
    {
      key: 'jobTitle',
      header: 'Job title',
      render: (row) => <JobTitleLabel jobTitle={row.jobTitle} jobLevel={row.jobLevel} />,
    },
    {
      key: 'location',
      header: 'Country / Branch',
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
      render: (row) =>
        row.baseSalary !== null && row.currencyCode !== null ? (
          <MoneyDisplay amount={row.baseSalary} currency={row.currencyCode} />
        ) : (
          <span className="text-muted-foreground">No salary record</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={population.rows}
      rowKey={(row) => row.id}
      rowHref={(row) => `/employees/${row.id}` as Route}
      caption="Employees with their current salary as of the reporting date"
      sort=""
      sortHref={() => compensationHref(buildQueryString({ ...state, page: '1' }))}
      emptyState={
        <EmptyState
          title="No employees match these filters"
          description="Try clearing a filter or widening the selection."
        />
      }
    />
  );
}

/**
 * The empty state.
 *
 * The two cases are distinct: there is no data, or the filters matched
 * nothing (QRY-007).
 */
function CompensationEmptyState({
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
        description="The workforce has not been loaded yet. Run the seed to populate the compensation view."
      />
    );
  }

  return (
    <NoMatchState
      description="No employees match the filters you have applied. Clear a filter to widen the selection."
      action={
        <a
          href={compensationHref(buildQueryString({ asOf: state.asOf }))}
          className="inline-block rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Clear filters
        </a>
      }
    />
  );
}

/**
 * The fallback when the request is not a query object at all.
 */
function CompensationUnavailable() {
  return (
    <>
      <PageHeader
        title="Compensation"
        description="The current salary population and its aggregates, grouped by currency."
      />
      <EmptyState
        title="The compensation view is unavailable"
        description="The request could not be read. Return to the compensation view with a clean address."
        action={
          <a
            href="/compensation"
            className="inline-block rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Reset the view
          </a>
        }
      />
    </>
  );
}

/**
 * A link within the compensation view.
 *
 * A plain function rather than a component, because it is a link not a
 * surface.
 */
function compensationHref(query: string): Route {
  return (query === '' ? '/compensation' : `/compensation${query}`) as Route;
}
