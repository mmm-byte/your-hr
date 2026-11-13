/**
 * Covers:
 * - QRY-001 the directory accepts the documented filters
 * - QRY-003 an unknown filter value is ignored in favour of the default
 * - QRY-004 the page size is bounded and clamped
 * - QRY-005 the sort field comes from an explicit allow-list
 * - RPT-004 the reporting date must be a real calendar day
 * - RPT-001 a reporting date in the future is ignored
 * - RPT-003 filters and the reporting date are carried in the query string
 *
 * Does not cover:
 * - The database query that consumes these values
 *   (tests/integration/employee-directory.test.ts)
 * - The directory UI and its filter bar (tests/component/directory.test.tsx)
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_EMPLOYEE_DIRECTORY_SORT,
  parseEmployeeDirectoryQuery,
} from '@/schemas/employee-directory';

/**
 * The reporting date is bounded by "not in the future", so this suite needs a
 * fixed clock — otherwise the expectations below would change meaning as the
 * real date moves past them.
 */
const FIXED_NOW = new Date('2026-06-15T12:00:00.000Z');

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

describe('parseEmployeeDirectoryQuery', () => {
  it('returns null for an input that is not a query object', () => {
    expect(parseEmployeeDirectoryQuery(null)).toBeNull();
    expect(parseEmployeeDirectoryQuery('page=1')).toBeNull();
    expect(parseEmployeeDirectoryQuery([])).toBeNull();
  });

  it('applies the documented defaults when nothing is supplied', () => {
    const query = parseEmployeeDirectoryQuery({});
    expect(query).not.toBeNull();
    expect(query?.page).toBe(1);
    expect(query?.pageSize).toBe(25);
    expect(query?.search).toBeUndefined();
    expect(query?.country).toBeUndefined();
    expect(query?.branch).toBeUndefined();
    expect(query?.department).toBeUndefined();
    expect(query?.level).toBeUndefined();
    expect(query?.status).toBeUndefined();
    expect(query?.workMode).toBeUndefined();
    expect(query?.sort).toBe(DEFAULT_EMPLOYEE_DIRECTORY_SORT);
    expect(query?.asOf).toBeUndefined();
  });

  it('accepts every documented filter', () => {
    const query = parseEmployeeDirectoryQuery({
      page: '2',
      pageSize: '50',
      search: '  Ann  ',
      country: 'US',
      branch: 'US-NYC',
      department: 'Payroll',
      level: '3',
      status: 'active',
      workMode: 'hybrid',
      sort: 'salary',
      asOf: '2026-03-01',
    });

    expect(query).toMatchObject({
      page: 2,
      pageSize: 50,
      search: 'Ann',
      country: 'US',
      branch: 'US-NYC',
      department: 'Payroll',
      level: 3,
      status: 'active',
      workMode: 'hybrid',
      sort: 'salary',
      asOf: '2026-03-01',
    });
  });

  it('ignores a reporting date in the future', () => {
    // The product asks what a person earned as of a date, so the future is
    // not a meaningful answer, and the date control does not offer it.
    const query = parseEmployeeDirectoryQuery({ asOf: '2027-01-01' });

    expect(query?.asOf).toBeUndefined();
  });

  it('ignores a malformed reporting date instead of failing', () => {
    const query = parseEmployeeDirectoryQuery({ asOf: '2026-02-30' });

    expect(query?.asOf).toBeUndefined();
  });

  it('ignores an unknown filter value instead of failing', () => {
    const query = parseEmployeeDirectoryQuery({
      country: 'ZZ',
      branch: 'XX-YYY',
      department: 'Not A Department',
      level: '99',
      status: 'retired',
      workMode: 'telepathic',
    });

    expect(query?.country).toBeUndefined();
    expect(query?.branch).toBeUndefined();
    expect(query?.department).toBeUndefined();
    expect(query?.level).toBeUndefined();
    expect(query?.status).toBeUndefined();
    expect(query?.workMode).toBeUndefined();
  });

  it('is case-sensitive about allow-listed values', () => {
    expect(parseEmployeeDirectoryQuery({ country: 'us' })?.country).toBeUndefined();
    expect(parseEmployeeDirectoryQuery({ status: 'Active' })?.status).toBeUndefined();
  });

  it('falls back to the default sort for an unrecognised sort', () => {
    expect(parseEmployeeDirectoryQuery({ sort: 'bogus' })?.sort).toBe(
      DEFAULT_EMPLOYEE_DIRECTORY_SORT,
    );
    expect(parseEmployeeDirectoryQuery({ sort: 'SALARY' })?.sort).toBe(
      DEFAULT_EMPLOYEE_DIRECTORY_SORT,
    );
    expect(parseEmployeeDirectoryQuery({ sort: '' })?.sort).toBe(
      DEFAULT_EMPLOYEE_DIRECTORY_SORT,
    );
  });

  it('clamps a page size above the cap rather than rejecting the request', () => {
    expect(parseEmployeeDirectoryQuery({ pageSize: '500' })?.pageSize).toBe(100);
    expect(parseEmployeeDirectoryQuery({ pageSize: '500' })).not.toBeNull();
  });

  it('rejects a reporting date that is not a real calendar day', () => {
    expect(parseEmployeeDirectoryQuery({ asOf: '2026-02-30' })?.asOf).toBeUndefined();
    expect(parseEmployeeDirectoryQuery({ asOf: '2026-13-01' })?.asOf).toBeUndefined();
    expect(parseEmployeeDirectoryQuery({ asOf: 'bogus' })?.asOf).toBeUndefined();
    expect(parseEmployeeDirectoryQuery({ asOf: '2026-03-01' })?.asOf).toBe(
      '2026-03-01',
    );
  });

  it('strips unknown keys instead of passing them through', () => {
    const query = parseEmployeeDirectoryQuery({ page: '1', bogus: 'x' });
    expect(query).not.toBeNull();
    expect(Object.keys(query as object)).not.toContain('bogus');
  });

  it('takes the first value when a filter was repeated', () => {
    expect(parseEmployeeDirectoryQuery({ country: ['US', 'IN'] })?.country).toBe('US');
  });
});
