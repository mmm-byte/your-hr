import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getDatabase } from '@/db/client';
import { queryAnalyticsGroups } from '@/db/queries/compensation';
import { parseCompensationAnalyticsQuery } from '@/schemas/compensation-analytics';
import { formatDateLong, todayDateOnly } from '@/lib/date-only';
import { formatCount } from '@/lib/money';
import { readQueryState, readReportingDate } from '@/lib/url-state';
import { AnalyticsControls } from '@/components/product/analytics-controls';
import { CountGroupPanel } from '@/components/product/aggregate-panel';
import { HeadcountBarChart } from '@/components/product/charts';
import { EmptyState } from '@/components/product/empty-state';
import { MoneyDisplay } from '@/components/product/money-display';
import { PageHeader } from '@/components/product/page-header';
import { ReportingDatePicker } from '@/components/product/reporting-date-picker';

export const metadata: Metadata = {
  title: 'Analytics',
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
 * The analytics view (UX-JOURNEY.md §5, Phase 5 item 5.3).
 *
 * A **server component**: the metric, the grouping, and the reporting date
 * live in the URL, so a shared link reproduces the exact question being
 * asked (RPT-003, ANA-001).
 *
 * Three rules this page holds to:
 *
 * - **A salary figure is always within one currency.** The query groups a
 *   salary metric by (group, currency), so a group's figure states the
 *   currency it is in and two currencies are never averaged together
 *   (MON-004, ANA-005).
 * - **A chart never carries the numbers alone.** Every chart is beside the
 *   table with the same figures and a text summary that states what it shows
 *   (D-036, UI.md → Accessibility).
 * - **An empty result is an empty state.** It is never a fabricated zero
 *   salary (ANA-004).
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const state = readQueryState(raw);
  const query = parseCompensationAnalyticsQuery(raw);

  if (query === null) {
    return <AnalyticsUnavailable />;
  }

  const reportingDate = readReportingDate(state, todayDateOnly());
  const db = getDatabase();
  const groups = await queryAnalyticsGroups(db, { ...query, asOf: reportingDate });

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Headcount and pay across the workforce, always within a single currency."
        context={`As of ${formatDateLong(reportingDate)}`}
        actions={
          <Suspense fallback={null}>
            <ReportingDatePicker value={reportingDate} max={todayDateOnly()} />
          </Suspense>
        }
      />

      <div className="space-y-5">
        <Suspense fallback={null}>
          <AnalyticsControls basePath="/analytics" />
        </Suspense>

        {groups.length === 0 ? (
          <EmptyState
            title="There is nothing to measure"
            description="No employees match this selection, so there is no figure to report. Change the grouping or clear a filter."
          />
        ) : (
          <AnalyticsGroups groups={groups} metric={query.metric} groupBy={query.groupBy} />
        )}
      </div>
    </>
  );
}

/**
 * The grouped figures, with the chart beside the table.
 *
 * The chart is a second way to read the numbers; the table is the way the
 * numbers are actually stated (D-036).
 */
function AnalyticsGroups({
  groups,
  metric,
  groupBy,
}: {
  groups: Awaited<ReturnType<typeof queryAnalyticsGroups>>;
  metric: string;
  groupBy: string;
}) {
  const isHeadcount = metric === 'headcount';

  // A salary metric's figures are per (group, currency), so the chart is
  // only drawn for a headcount — a bar per group would blend the currencies.
  const chartData = isHeadcount
    ? groups.map((group) => ({ label: group.group, value: group.count }))
    : [];

  const total = groups.reduce((sum, group) => sum + group.count, 0);

  return (
    <>
      {isHeadcount && chartData.length > 0 ? (
        <section aria-label="Headcount by group" className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold">Headcount by {groupLabel(groupBy)}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatCount(total)} {total === 1 ? 'employee' : 'employees'} in the current
              workforce, shown by {groupLabel(groupBy).toLowerCase()}.
            </p>
          </div>
          <HeadcountBarChart data={chartData} title={`Headcount by ${groupLabel(groupBy)}`} />
        </section>
      ) : null}

      <CountGroupPanel
        heading={isHeadcount ? `Headcount by ${groupLabel(groupBy)}` : `${metricLabel(metric)} by ${groupLabel(groupBy)}`}
        description={
          isHeadcount
            ? 'The current workforce. Terminated employees are not included.'
            : 'Each figure is in one currency. Currencies are never averaged together.'
        }
        groups={groups.map((group) => ({
          label: group.currency === null ? group.group : `${group.group} · ${group.currency}`,
          count: group.count,
          figure: group,
        }))}
        renderLabel={(group) => {
          const figure = (group as { figure?: (typeof groups)[number] }).figure;
          if (figure === undefined || figure.currency === null) {
            return <span>{group.label}</span>;
          }
          const amount = metric === 'medianSalary' ? figure.median : figure.average;
          return (
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span>{figure.group}</span>
              {amount === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <MoneyDisplay amount={amount} currency={figure.currency} className="text-xs" />
              )}
            </span>
          );
        }}
      />
    </>
  );
}

/**
 * The plain-language name of a grouping.
 */
function groupLabel(groupBy: string): string {
  switch (groupBy) {
    case 'department':
      return 'Department';
    case 'jobLevel':
      return 'Job level';
    case 'status':
      return 'Status';
    case 'country':
    default:
      return 'Country';
  }
}

/**
 * The plain-language name of a metric.
 */
function metricLabel(metric: string): string {
  switch (metric) {
    case 'medianSalary':
      return 'Median salary';
    case 'averageSalary':
      return 'Average salary';
    case 'salaryDistribution':
      return 'Salary distribution';
    case 'headcount':
    default:
      return 'Headcount';
  }
}

/**
 * The fallback when the request is not a query object at all.
 */
function AnalyticsUnavailable() {
  return (
    <>
      <PageHeader title="Analytics" description="Headcount and pay across the workforce." />
      <EmptyState
        title="The analytics view is unavailable"
        description="The request could not be read. Return to the analytics view with a clean address."
        action={
          <a
            href="/analytics"
            className="inline-block rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Reset the view
          </a>
        }
      />
    </>
  );
}
