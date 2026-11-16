'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { Route } from 'next';
import {
  applyQueryChange,
  buildQueryString,
  readQueryState,
} from '@/lib/url-state';
import {
  ANALYTICS_METRICS,
  DEFAULT_ANALYTICS_GROUPING,
  DEFAULT_ANALYTICS_METRIC,
  supportedGroupings,
  type AnalyticsGrouping,
  type AnalyticsMetric,
} from '@/schemas/compensation-analytics';

/**
 * The analytics controls (ANA-001, QRY-003, QRY-005, RPT-003).
 *
 * The metric and the grouping live in the **URL**, exactly like the
 * directory's filters (D-029). A shared link therefore reproduces the exact
 * question being asked, and the back button steps through the questions the
 * reader has asked.
 *
 * Two rules shape the control:
 *
 * - **The pairing is filtered, not disabled.** A salary distribution is
 *   grouped by level and nothing else, so the grouping selector only offers
 *   the groupings that metric supports. Offering an invalid pairing and
 *   resolving it silently would make the page's own controls lie (QRY-003).
 * - **The labels are words, not codes.** "Median salary" rather than
 *   "medianSalary" — the control shows the product, not the implementation.
 */

const METRIC_LABELS: Readonly<Record<AnalyticsMetric, string>> = {
  headcount: 'Headcount',
  medianSalary: 'Median salary',
  averageSalary: 'Average salary',
  salaryDistribution: 'Distribution by level',
};

const GROUPING_LABELS: Readonly<Record<AnalyticsGrouping, string>> = {
  country: 'Country',
  department: 'Department',
  jobLevel: 'Job level',
  status: 'Status',
};

export function AnalyticsControls({
  basePath,
  extraState = {},
}: {
  /** The path the controls navigate within, e.g. `/analytics`. */
  basePath: string;
  /** Any other state that must survive a metric or grouping change. */
  extraState?: Readonly<Record<string, string | undefined>>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const state = readQueryState(searchParams);

  const metric = (state.metric ?? DEFAULT_ANALYTICS_METRIC) as AnalyticsMetric;
  const grouping = (state.groupBy ?? DEFAULT_ANALYTICS_GROUPING) as AnalyticsGrouping;
  const groupings = supportedGroupings(metric);

  function navigate(next: Record<string, string | null | undefined>): void {
    const updated = applyQueryChange(state, { ...extraState, ...next });
    const query = buildQueryString(updated);
    startTransition(() => {
      router.replace((query === '' ? basePath : `${basePath}${query}`) as Route, {
        scroll: false,
      });
    });
  }

  return (
    <form
      aria-label="Choose what to measure and how to group it"
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="flex-1">
        <label htmlFor="analytics-metric" className="block text-sm font-medium">
          Measure
        </label>
        <select
          id="analytics-metric"
          name="metric"
          value={metric}
          onChange={(event) => navigate({ metric: event.target.value })}
          className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {ANALYTICS_METRICS.map((option) => (
            <option key={option} value={option}>
              {METRIC_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label htmlFor="analytics-grouping" className="block text-sm font-medium">
          Group by
        </label>
        <select
          id="analytics-grouping"
          name="groupBy"
          value={grouping}
          onChange={(event) => navigate({ groupBy: event.target.value })}
          className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {groupings.map((option) => (
            <option key={option} value={option}>
              {GROUPING_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
