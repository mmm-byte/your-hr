/**
 * Compensation analytics request schema (ANA-001, ANA-005, ANA-007, RPT-003).
 *
 * Purpose: validate the compensation and analytics query strings. These
 * surfaces accept a **metric**, a **grouping**, and a set of filters — all
 * allow-listed, because "no arbitrary column names or generated SQL accepted
 * from clients" is part of the server contract (docs/API-CONTRACT.md).
 *
 * Called by: src/db/queries/compensation.ts and the /compensation, /analytics routes.
 * Reads: nothing — pure validation, no I/O and no database access.
 * Rules: ANA-001 (explicit scope semantics), ANA-005 (currency-sensitive
 *        metrics grouped by currency), ANA-007 (server-side filtering),
 *        QRY-003 (unknown values ignored), QRY-005 (allow-listed grouping),
 *        RPT-003 (reporting date in the URL).
 * Tests: tests/unit/compensation-analytics-schema.test.ts
 *
 * Design notes
 * ------------
 * - The directory filters are **reused**, not restated: the compensation table
 *   uses the same filter model as the directory, so the same schema and the
 *   same defaults apply to both. Two copies of an allow-list would drift.
 * - A metric and a grouping are separate allow-lists because not every metric
 *   supports every grouping. An unsupported pairing falls back to the default
 *   pairing rather than erroring (QRY-003).
 */

import { z } from 'zod';
import {
  branchSchema,
  countrySchema,
  departmentSchema,
  levelSchema,
  queryString,
  statusSchema,
  workModeSchema,
} from './query-params';

/**
 * The predefined analytics.
 *
 * A small, decision-useful set rather than a query builder (docs/FEATURES.md →
 * Analytics).
 */
export const ANALYTICS_METRICS = [
  'headcount',
  'medianSalary',
  'averageSalary',
  'salaryDistribution',
] as const;

export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];

/** The default metric when none is supplied or the supplied one is unknown. */
export const DEFAULT_ANALYTICS_METRIC: AnalyticsMetric = 'headcount';

/**
 * The dimensions a metric may be grouped by.
 *
 * `country` is the default because every workforce can be summarised by
 * country without a salary record existing.
 */
export const ANALYTICS_GROUPINGS = [
  'country',
  'department',
  'jobLevel',
  'status',
] as const;

export type AnalyticsGrouping = (typeof ANALYTICS_GROUPINGS)[number];

/** The default grouping when none is supplied or the supplied one is unknown. */
export const DEFAULT_ANALYTICS_GROUPING: AnalyticsGrouping = 'country';

/**
 * Which groupings each metric supports.
 *
 * A salary distribution is a distribution, not a per-country figure, so it is
 * grouped by level. Every other metric supports every grouping.
 */
const METRIC_GROUPINGS: Readonly<Record<AnalyticsMetric, readonly AnalyticsGrouping[]>> = {
  headcount: ANALYTICS_GROUPINGS,
  medianSalary: ANALYTICS_GROUPINGS,
  averageSalary: ANALYTICS_GROUPINGS,
  salaryDistribution: ['jobLevel'],
};

/** A metric. An unrecognised metric falls back to the default. */
const metricSchema = z.preprocess(
  queryString,
  z.enum(ANALYTICS_METRICS).catch(DEFAULT_ANALYTICS_METRIC),
);

/**
 * A grouping.
 *
 * An unrecognised grouping falls back to the default. Whether the grouping is
 * valid *for the chosen metric* is reconciled after the whole object is
 * parsed, because a field schema cannot see its sibling.
 */
const groupBySchema = z.preprocess(
  queryString,
  z.enum(ANALYTICS_GROUPINGS).catch(DEFAULT_ANALYTICS_GROUPING),
);

/**
 * The validated compensation analytics request.
 */
export const compensationAnalyticsQuerySchema = z.object({
  metric: metricSchema,
  groupBy: groupBySchema,
  country: countrySchema,
  branch: branchSchema,
  department: departmentSchema,
  level: levelSchema,
  status: statusSchema,
  workMode: workModeSchema,
});

export type CompensationAnalyticsQuery = z.infer<typeof compensationAnalyticsQuerySchema>;

/**
 * Parse a raw query string into a validated analytics request.
 *
 * Returns `null` only when the input is not a query object at all.
 *
 * After the individual fields are validated, the metric/grouping pairing is
 * reconciled: a grouping the chosen metric cannot answer falls back to that
 * metric's default grouping, so the request is always answerable (QRY-003).
 */
export function parseCompensationAnalyticsQuery(
  raw: unknown,
): CompensationAnalyticsQuery | null {
  const result = compensationAnalyticsQuerySchema.safeParse(raw);
  if (!result.success) {
    return null;
  }

  const metric = result.data.metric;
  const allowed = METRIC_GROUPINGS[metric];
  const groupBy = allowed.includes(result.data.groupBy)
    ? result.data.groupBy
    : (allowed[0] as AnalyticsGrouping);

  return { ...result.data, groupBy };
}

/**
 * The groupings a metric supports.
 *
 * Exposed so the query layer can refuse a pairing the schema already resolved
 * to its default, and so the UI can offer only the valid options.
 */
export function supportedGroupings(metric: AnalyticsMetric): readonly AnalyticsGrouping[] {
  return METRIC_GROUPINGS[metric];
}
