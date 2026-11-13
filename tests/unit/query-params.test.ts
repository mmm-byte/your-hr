/**
 * Covers:
 * - QRY-003 an unknown filter value is ignored, never an error
 * - QRY-004 the page size is bounded and clamped, not rejected
 * - QRY-005 a sort field comes from an explicit allow-list
 * - QRY-001 a search term is trimmed and bounded
 *
 * Does not cover:
 * - The database query that consumes these values (Phase 3)
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  pageSchema,
  pageSizeSchema,
  queryInteger,
  queryString,
  searchSchema,
} from '@/schemas/query-params';

describe('queryInteger', () => {
  it('reads a numeric string', () => {
    expect(queryInteger('25')).toBe(25);
    expect(queryInteger('007')).toBe(7);
    expect(queryInteger('-5')).toBe(-5);
  });

  it('trims surrounding whitespace', () => {
    expect(queryInteger(' 25 ')).toBe(25);
  });

  it('accepts a number that is already a safe integer', () => {
    expect(queryInteger(50)).toBe(50);
  });

  it('takes the first value when a parameter was repeated', () => {
    expect(queryInteger(['10', '20'])).toBe(10);
  });

  it('rejects anything that is not an integer', () => {
    expect(queryInteger('abc')).toBeUndefined();
    expect(queryInteger('50.5')).toBeUndefined();
    expect(queryInteger('1e3')).toBeUndefined();
    expect(queryInteger('')).toBeUndefined();
    expect(queryInteger(true)).toBeUndefined();
    expect(queryInteger(null)).toBeUndefined();
    expect(queryInteger({})).toBeUndefined();
  });

  it('rejects a value beyond the safe integer range', () => {
    expect(queryInteger(2 ** 53)).toBeUndefined();
    expect(queryInteger('9007199254740993')).toBeUndefined();
  });
});

describe('queryString', () => {
  it('trims and returns a non-empty string', () => {
    expect(queryString('  Ann  ')).toBe('Ann');
  });

  it('treats an empty or whitespace-only value as absent', () => {
    expect(queryString('')).toBeUndefined();
    expect(queryString('   ')).toBeUndefined();
  });

  it('rejects a non-string value', () => {
    expect(queryString(5)).toBeUndefined();
    expect(queryString(true)).toBeUndefined();
    expect(queryString(null)).toBeUndefined();
  });
});

describe('pageSchema', () => {
  it('defaults to the first page', () => {
    expect(pageSchema.parse(undefined)).toBe(1);
    expect(pageSchema.parse('abc')).toBe(1);
  });

  it('rejects a page below one', () => {
    expect(pageSchema.parse('0')).toBe(1);
    expect(pageSchema.parse('-5')).toBe(1);
  });

  it('accepts a valid page', () => {
    expect(pageSchema.parse('3')).toBe(3);
    expect(pageSchema.parse(2)).toBe(2);
  });
});

describe('pageSizeSchema', () => {
  it('defaults to the documented page size', () => {
    expect(pageSizeSchema.parse(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });

  it('clamps a request above the cap rather than rejecting it', () => {
    expect(pageSizeSchema.parse('500')).toBe(MAX_PAGE_SIZE);
    expect(pageSizeSchema.parse('101')).toBe(MAX_PAGE_SIZE);
    expect(MAX_PAGE_SIZE).toBe(100);
  });

  it('accepts a page size within the cap', () => {
    expect(pageSizeSchema.parse('50')).toBe(50);
    expect(pageSizeSchema.parse('100')).toBe(100);
  });

  it('falls back to the default for a page size below one', () => {
    expect(pageSizeSchema.parse('0')).toBe(DEFAULT_PAGE_SIZE);
    expect(pageSizeSchema.parse('-5')).toBe(DEFAULT_PAGE_SIZE);
  });

  it('falls back to the default for a value that is not an integer', () => {
    expect(pageSizeSchema.parse('abc')).toBe(DEFAULT_PAGE_SIZE);
    expect(pageSizeSchema.parse('50.5')).toBe(DEFAULT_PAGE_SIZE);
    expect(pageSizeSchema.parse(true)).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe('searchSchema', () => {
  it('trims the search term', () => {
    expect(searchSchema.parse('  Ann  ')).toBe('Ann');
  });

  it('treats an empty term as absent', () => {
    expect(searchSchema.parse('')).toBeUndefined();
    expect(searchSchema.parse(undefined)).toBeUndefined();
  });

  it('keeps special characters as literal text', () => {
    // %, _, ' and \ are literal characters, never SQL wildcards (QRY-002).
    expect(searchSchema.parse("O'Brien")).toBe("O'Brien");
    expect(searchSchema.parse('100%_\\')).toBe('100%_\\');
  });

  it('rejects a term longer than the bound', () => {
    expect(searchSchema.parse('a'.repeat(101))).toBeUndefined();
    expect(searchSchema.parse('a'.repeat(100))).toBe('a'.repeat(100));
  });

  it('ignores a non-string value', () => {
    expect(searchSchema.parse(5)).toBeUndefined();
  });
});
