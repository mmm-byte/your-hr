/**
 * Covers:
 * - RPT-004 a `date` column decodes to its raw `YYYY-MM-DD` text
 * - The Neon override applies to both the text and the binary protocol
 * - Every non-`date` type still falls back to the driver's own parser
 *
 * Does not cover:
 * - End-to-end decoding through a live database
 *   (tests/integration/date-parsers.test.ts)
 * - The timezone-sensitive driver behaviour that motivated this module
 *   (tests/integration/date-parsers.test.ts)
 */
import { describe, expect, it } from 'vitest';
import { types as pgTypes } from '@neondatabase/serverless';
import {
  neonDateTypes,
  parseDateOnly,
  PG_DATE_OID,
  pgliteDateParsers,
} from '@/db/date-parsers';

describe('parseDateOnly', () => {
  it('returns the calendar day unchanged', () => {
    expect(parseDateOnly('2023-05-09')).toBe('2023-05-09');
    expect(parseDateOnly('2024-02-29')).toBe('2024-02-29');
    expect(parseDateOnly('1999-12-31')).toBe('1999-12-31');
  });

  it('never constructs a Date, so no timezone can shift the day', () => {
    // A `Date` would be an instant; a calendar day must stay text.
    expect(typeof parseDateOnly('2023-05-09')).toBe('string');
  });
});

describe('pgliteDateParsers', () => {
  it('overrides the parser for the `date` type OID', () => {
    expect(pgliteDateParsers[PG_DATE_OID]).toBe(parseDateOnly);
  });

  it('does not override any other type', () => {
    const overridden = Object.keys(pgliteDateParsers).map(Number);
    expect(overridden).toEqual([PG_DATE_OID]);
  });
});

describe('neonDateTypes', () => {
  it('overrides the `date` parser for the text protocol', () => {
    expect(neonDateTypes.getTypeParser(PG_DATE_OID, 'text')).toBe(parseDateOnly);
  });

  it('overrides the `date` parser for the binary protocol', () => {
    expect(neonDateTypes.getTypeParser(PG_DATE_OID, 'binary')).toBe(parseDateOnly);
  });

  it('falls back to the driver parser for every other type', () => {
    // `numeric` (1700) must keep its exact decimal string semantics (MON-002).
    expect(neonDateTypes.getTypeParser(1700, 'text')).toBe(pgTypes.getTypeParser(1700, 'text'));
    // `timestamptz` (1184) is an absolute instant and is left alone.
    expect(neonDateTypes.getTypeParser(1184, 'text')).toBe(pgTypes.getTypeParser(1184, 'text'));
  });

  it('overrides the `date` parser when no format is given', () => {
    // The driver normalises a missing format to 'text'.
    expect(neonDateTypes.getTypeParser(PG_DATE_OID)).toBe(parseDateOnly);
  });
});
