/**
 * Covers:
 * - ANA-001 an analytics request has explicit, allow-listed scope
 * - ANA-005 the currency-sensitive metrics are selected by an allow-list
 * - QRY-003 an unknown metric, grouping, or filter is ignored
 * - QRY-005 the grouping comes from an explicit allow-list
 *
 * Does not cover:
 * - The database aggregate that consumes these values (Phase 5)
 * - The analytics charts and their summaries (Phase 5)
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANALYTICS_GROUPING,
  DEFAULT_ANALYTICS_METRIC,
  parseCompensationAnalyticsQuery,
  supportedGroupings,
} from '@/schemas/compensation-analytics';

describe('parseCompensationAnalyticsQuery', () => {
  it('returns null for an input that is not a query object', () => {
    expect(parseCompensationAnalyticsQuery(null)).toBeNull();
    expect(parseCompensationAnalyticsQuery('metric=headcount')).toBeNull();
  });

  it('applies the documented defaults when nothing is supplied', () => {
    const query = parseCompensationAnalyticsQuery({});
    expect(query?.metric).toBe(DEFAULT_ANALYTICS_METRIC);
    expect(query?.groupBy).toBe(DEFAULT_ANALYTICS_GROUPING);
  });

  it('accepts every allow-listed metric', () => {
    for (const metric of ['headcount', 'medianSalary', 'averageSalary', 'salaryDistribution']) {
      expect(parseCompensationAnalyticsQuery({ metric })?.metric).toBe(metric);
    }
  });

  it('ignores an unknown metric in favour of the default', () => {
    expect(parseCompensationAnalyticsQuery({ metric: 'bogus' })?.metric).toBe(
      DEFAULT_ANALYTICS_METRIC,
    );
    expect(parseCompensationAnalyticsQuery({ metric: 'Headcount' })?.metric).toBe(
      DEFAULT_ANALYTICS_METRIC,
    );
  });

  it('ignores an unknown grouping in favour of the default', () => {
    expect(parseCompensationAnalyticsQuery({ groupBy: 'bogus' })?.groupBy).toBe(
      DEFAULT_ANALYTICS_GROUPING,
    );
  });

  it('falls back to a grouping the metric can answer', () => {
    // A salary distribution is grouped by job level only; a country grouping
    // would be a request the application cannot answer.
    const query = parseCompensationAnalyticsQuery({
      metric: 'salaryDistribution',
      groupBy: 'country',
    });
    expect(query?.groupBy).toBe('jobLevel');
    expect(supportedGroupings('salaryDistribution')).toEqual(['jobLevel']);
  });

  it('keeps a grouping the metric supports', () => {
    const query = parseCompensationAnalyticsQuery({
      metric: 'medianSalary',
      groupBy: 'department',
    });
    expect(query?.groupBy).toBe('department');
  });

  it('shares the directory filter model', () => {
    const query = parseCompensationAnalyticsQuery({
      country: 'DE',
      branch: 'DE-BER',
      department: 'Payroll',
      level: '2',
      status: 'active',
      workMode: 'office',
    });
    expect(query).toMatchObject({
      country: 'DE',
      branch: 'DE-BER',
      department: 'Payroll',
      level: 2,
      status: 'active',
      workMode: 'office',
    });
  });

  it('ignores an unknown filter value instead of failing', () => {
    const query = parseCompensationAnalyticsQuery({
      country: 'ZZ',
      level: '0',
      status: 'retired',
    });
    expect(query?.country).toBeUndefined();
    expect(query?.level).toBeUndefined();
    expect(query?.status).toBeUndefined();
  });
});
