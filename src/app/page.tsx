import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { getDatabase } from '@/db/client';
import {
  queryCurrencyAggregates,
  queryDataQualityIssues,
  queryDistribution,
  queryRecentChanges,
  queryWorkforceSummary,
} from '@/db/queries/compensation';
import { formatDateLong, todayDateOnly } from '@/lib/date-only';
import { formatCount } from '@/lib/money';
import { readQueryState, readReportingDate } from '@/lib/url-state';
import { AggregatePanel } from '@/components/product/aggregate-panel';
import { CountGroupPanel } from '@/components/product/aggregate-panel';
import { MoneyDisplay } from '@/components/product/money-display';
import { PageHeader } from '@/components/product/page-header';
import { ReportingDatePicker } from '@/components/product/reporting-date-picker';

export const metadata: Metadata = {
  title: 'Overview',
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
 * The overview (D-012, UX-JOURNEY.md §5 → Overview).
 *
 * `/` **is** Overview. There is deliberately no `/overview` route and no
 * redirect to one — a second URL for the same page would make shared links
 * ambiguous and would contradict the route map in `docs/UX-JOURNEY.md` §2.
 *
 * A **server component**: every figure is computed by the database, so the
 * browser receives a handful of numbers rather than the workforce (ANA-007).
 *
 * The rules this page holds to:
 *
 * - **Every figure names its scope.** "Active", "on leave", and "terminated"
 *   are separate counts, not one blended number, because a headcount that
 *   includes leavers and one that does not are different facts (ANA-001,
 *   ANA-002).
 * - **There is no mixed-currency total.** The compensation summary is
 *   grouped by currency, so each figure states the currency it is in
 *   (MON-004, RPT-007).
 * - **Every metric card is a link** to the filtered view that explains it, so
 *   a reader can go from "how many?" to "which ones?" in one click.
 */
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const state = readQueryState(raw);
  const reportingDate = readReportingDate(state, todayDateOnly());

  const db = getDatabase();
  const [summary, aggregates, distribution, quality, recentChanges] = await Promise.all([
    queryWorkforceSummary(db),
    queryCurrencyAggregates(db, { asOf: reportingDate }),
    queryDistribution(db),
    queryDataQualityIssues(db),
    queryRecentChanges(db, 5),
  ]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Workforce size, compensation context, and the records that need review."
        context={`As of ${formatDateLong(reportingDate)}`}
        actions={
          <Suspense fallback={null}>
            <ReportingDatePicker value={reportingDate} max={todayDateOnly()} />
          </Suspense>
        }
      />

      <div className="space-y-6">
        <section aria-label="Workforce size" className="space-y-3">
          <h2 className="text-sm font-semibold">Workforce</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Active"
              value={formatCount(summary.active)}
              href="/employees?status=active"
              description="Employed today"
            />
            <MetricCard
              label="On leave"
              value={formatCount(summary.onLeave)}
              href="/employees?status=on_leave"
              description="Employed, not working"
            />
            <MetricCard
              label="Terminated"
              value={formatCount(summary.terminated)}
              href="/employees?status=terminated"
              description="Have left the company"
            />
            <MetricCard
              label="Total headcount"
              value={formatCount(summary.total)}
              href="/employees"
              description="Every employee, active or terminated"
            />
          </div>
        </section>

        <AggregatePanel
          figures={aggregates.byCurrency}
          heading="Current pay by currency"
          description="Each block is one currency. Figures are never added across currencies."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <CountGroupPanel
            heading="By country"
            groups={distribution.byCountry}
            description="Every employee, by the country they work in."
            renderLabel={(group) => (
              <Link
                href={`/employees?country=${group.label}` as Route}
                className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {group.label}
              </Link>
            )}
          />
          <CountGroupPanel
            heading="By department"
            groups={distribution.byDepartment.slice(0, 8)}
            description="The eight largest departments."
            renderLabel={(group) => (
              <Link
                href={`/employees?department=${encodeURIComponent(group.label)}` as Route}
                className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {group.label}
              </Link>
            )}
          />
        </div>

        <DataQualityAttention count={quality.affectedEmployees} />

        <RecentChanges changes={recentChanges} />
      </div>
    </>
  );
}

/**
 * One metric card.
 *
 * Every card is a link, so the number is not a dead end — the reader can go
 * straight to the filtered view that explains it (UX-JOURNEY §5 → Overview).
 */
function MetricCard({
  label,
  value,
  href,
  description,
}: {
  label: string;
  value: string;
  href: string;
  description: string;
}) {
  return (
    <Link
      href={href as Route}
      className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium">
        View
        <ArrowRight
          aria-hidden="true"
          className="size-3 transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}

/**
 * The data-quality attention count.
 *
 * A link to the work queue, because "4,965 employees need review" is a
 * question the reader will want answered next.
 */
function DataQualityAttention({ count }: { count: number }) {
  return (
    <Link
      href="/data-quality"
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div>
        <p className="text-sm font-medium">Records that need review</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {count === 0
            ? 'Every check passed.'
            : `${formatCount(count)} ${count === 1 ? 'employee has' : 'employees have'} at least one finding.`}
        </p>
      </div>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
    </Link>
  );
}

/**
 * The recent salary changes.
 *
 * Each change states the salary before and after, the effective date, and the
 * reason — so the overview says *what changed*, not merely that something
 * did.
 */
function RecentChanges({
  changes,
}: {
  changes: Awaited<ReturnType<typeof queryRecentChanges>>;
}) {
  return (
    <section aria-label="Recent salary changes" className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Recent salary changes</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The most recently recorded changes, newest first.
        </p>
      </div>

      {changes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-6 text-center text-sm text-muted-foreground">
          No salary changes have been recorded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {changes.map((change) => (
            <li
              key={`${change.employeeId}-${change.effectiveFrom}`}
              className="rounded-lg border border-border bg-surface p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link
                  href={`/employees/${change.employeeId}` as Route}
                  className="text-sm font-medium underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {change.firstName} {change.lastName}
                </Link>
                <span className="text-xs text-muted-foreground">
                  Effective {formatDateLong(change.effectiveFrom)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {change.previousBaseSalary === null ? (
                  <span className="text-muted-foreground">First recorded salary</span>
                ) : (
                  <>
                    <span className="text-muted-foreground line-through">
                      <MoneyDisplay
                        amount={change.previousBaseSalary}
                        currency={change.currencyCode}
                        className="text-muted-foreground"
                      />
                    </span>
                    <TrendingUp aria-hidden="true" className="size-3.5" />
                  </>
                )}
                <MoneyDisplay amount={change.baseSalary} currency={change.currencyCode} />
              </div>
              {change.changeReason === null ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  A seeded record — no reason was recorded.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Reason: {change.changeReason}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
