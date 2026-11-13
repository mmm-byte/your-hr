/**
 * Covers:
 * - QRY-006 applying or changing a filter resets the page to 1
 * - RPT-003 the filters and the reporting date travel in the URL
 * - QRY-003 an ignored filter leaves no trace in the URL
 *
 * Does not cover:
 * - The router itself (Next.js), only the pure state transitions
 */
import { describe, expect, it } from 'vitest';
import {
  applyQueryChange,
  buildQueryString,
  clearFilters,
  hasActiveFilter,
  readQueryState,
} from '@/lib/url-state';

describe('buildQueryString', () => {
  it('omits a key with no value', () => {
    expect(buildQueryString({ page: '1', search: undefined })).toBe('?page=1');
  });

  it('omits an empty value', () => {
    expect(buildQueryString({ page: '1', search: '' })).toBe('?page=1');
  });

  it('returns an empty string when there is nothing to carry', () => {
    expect(buildQueryString({})).toBe('');
  });

  it('sorts the keys, so the same state always produces the same string', () => {
    expect(buildQueryString({ sort: 'salary', country: 'US', page: '1' })).toBe(
      '?country=US&page=1&sort=salary',
    );
  });
});

describe('applyQueryChange', () => {
  it('resets the page to 1 when a filter changes', () => {
    const next = applyQueryChange(
      { page: '7', country: 'US' },
      { country: 'IN' },
    );
    expect(next.page).toBe('1');
    expect(next.country).toBe('IN');
  });

  it('resets the page to 1 when a filter is cleared', () => {
    const next = applyQueryChange({ page: '7', country: 'US' }, { country: null });
    expect(next.page).toBe('1');
    expect(next.country).toBeUndefined();
  });

  it('resets the page to 1 when the search term changes', () => {
    const next = applyQueryChange({ page: '7' }, { search: 'ann' });
    expect(next.page).toBe('1');
  });

  it('leaves the page alone when only the page changes', () => {
    const next = applyQueryChange({ page: '7', country: 'US' }, { page: '8' });
    expect(next.page).toBe('8');
    expect(next.country).toBe('US');
  });

  it('can be told not to reset the page', () => {
    const next = applyQueryChange({ page: '7' }, { country: 'IN' }, { resetPage: false });
    expect(next.page).toBe('7');
  });

  it('keeps the reporting date when a filter changes', () => {
    const next = applyQueryChange(
      { page: '1', asOf: '2026-03-01' },
      { country: 'IN' },
    );
    expect(next.asOf).toBe('2026-03-01');
  });
});

describe('clearFilters', () => {
  it('removes every filter', () => {
    const next = clearFilters({
      page: '3',
      search: 'ann',
      country: 'US',
      branch: 'US-NYC',
      department: 'Payroll',
      level: '3',
      status: 'active',
      workMode: 'remote',
    });
    expect(next).toEqual({});
  });

  it('keeps the reporting date and the sort, which are not filters', () => {
    const next = clearFilters({
      page: '3',
      search: 'ann',
      asOf: '2026-03-01',
      sort: 'salary',
    });
    expect(next.asOf).toBe('2026-03-01');
    expect(next.sort).toBe('salary');
    expect(next.search).toBeUndefined();
  });
});

describe('hasActiveFilter', () => {
  it('is false when nothing narrows the results', () => {
    expect(hasActiveFilter({})).toBe(false);
    expect(hasActiveFilter({ page: '1' })).toBe(false);
  });

  it('does not count the sort or the reporting date as filters', () => {
    expect(hasActiveFilter({ sort: 'salary', asOf: '2026-03-01' })).toBe(false);
  });

  it('is true when a filter is narrowing the results', () => {
    expect(hasActiveFilter({ country: 'US' })).toBe(true);
    expect(hasActiveFilter({ search: 'ann' })).toBe(true);
  });
});

describe('readQueryState', () => {
  it('reads a URLSearchParams into a plain record', () => {
    const params = new URLSearchParams('page=2&country=US');
    expect(readQueryState(params)).toEqual({ page: '2', country: 'US' });
  });

  it('takes the first value of a repeated parameter', () => {
    const params = new URLSearchParams('country=US&country=IN');
    expect(readQueryState(params)).toEqual({ country: 'US' });
  });

  it('reads a plain record, taking the first of a repeated value', () => {
    expect(readQueryState({ country: ['US', 'IN'] })).toEqual({ country: 'US' });
    expect(readQueryState({ country: 'US' })).toEqual({ country: 'US' });
  });
});
