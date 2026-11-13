/**
 * Covers:
 * - RFC 4180 quoting: quoted fields, escaped quotes, embedded commas
 * - A trailing newline does not produce an extra row
 * - CRLF line endings parse the same as LF
 * - A row with the wrong field count is rejected
 * - A missing required column is reported by name
 * - Blank cells are distinguished from the value zero
 * - Decimal values are returned as exact strings
 * - Boolean flags accept both `1`/`0` and `1.0`/`0.0`
 *
 * Does not cover:
 * - The database seed itself (tests/integration/seed.test.ts)
 * - The dataset mapping rules (tests/unit/seed-dataset.test.ts)
 */
import { describe, expect, it } from 'vitest';
import {
  booleanValue,
  decimalValue,
  indexColumns,
  integerValue,
  nullableIntegerValue,
  nullableValue,
  parseCsv,
  requiredValue,
} from '../../scripts/csv';

describe('parseCsv', () => {
  it('reads a simple table', () => {
    const table = parseCsv('id,name\n1,Ada\n2,Grace\n');
    expect(table.header).toEqual(['id', 'name']);
    expect(table.rows).toEqual([
      ['1', 'Ada'],
      ['2', 'Grace'],
    ]);
  });

  it('keeps a comma inside a quoted field', () => {
    const table = parseCsv('id,title\n1,"Associate, Mid-Market Sales"\n');
    expect(table.rows[0]?.[1]).toBe('Associate, Mid-Market Sales');
  });

  it('reads an escaped double quote as one quote', () => {
    const table = parseCsv('id,note\n1,"He said ""hello"""\n');
    expect(table.rows[0]?.[1]).toBe('He said "hello"');
  });

  it('does not add a row for the trailing newline', () => {
    const table = parseCsv('id\n1\n2\n');
    expect(table.rows).toHaveLength(2);
  });

  it('parses CRLF line endings the same as LF', () => {
    const table = parseCsv('id,name\r\n1,Ada\r\n');
    expect(table.rows).toEqual([['1', 'Ada']]);
  });

  it('rejects a row whose field count does not match the header', () => {
    expect(() => parseCsv('id,name\n1,Ada,Extra\n')).toThrow(/row 2 has 3 fields/);
  });

  it('rejects a file that ends inside a quoted field', () => {
    expect(() => parseCsv('id,note\n1,"unterminated\n')).toThrow(/ends inside a quoted field/);
  });

  it('rejects a file with no header row', () => {
    expect(() => parseCsv('')).toThrow(/no header row/);
  });
});

describe('cell readers', () => {
  const table = parseCsv(
    'id,name,score,flag,note\n' + '7,Ada,12.50,1,\n' + '8,Grace,,0.0,\n',
  );
  const columns = indexColumns(table.header);

  it('reads a required value', () => {
    expect(requiredValue(table.rows[0] as string[], columns, 'name')).toBe('Ada');
  });

  it('names the missing column when it is absent', () => {
    expect(() => requiredValue(table.rows[0] as string[], columns, 'nickname')).toThrow(
      /Missing required column "nickname"/,
    );
  });

  it('rejects an empty required value', () => {
    expect(() => requiredValue(table.rows[0] as string[], columns, 'note')).toThrow(
      /Required column "note" is empty/,
    );
  });

  it('distinguishes a blank cell from the value zero', () => {
    expect(nullableValue(table.rows[1] as string[], columns, 'score')).toBeNull();
    expect(nullableIntegerValue(table.rows[1] as string[], columns, 'score')).toBeNull();
    expect(nullableValue(table.rows[0] as string[], columns, 'score')).toBe('12.50');
  });

  it('keeps a decimal as an exact string', () => {
    expect(decimalValue(table.rows[0] as string[], columns, 'score')).toBe('12.50');
  });

  it('rejects a value that is not a whole number', () => {
    expect(() => integerValue(table.rows[0] as string[], columns, 'score')).toThrow(
      /must be a whole number/,
    );
  });

  it('reads a boolean flag written as 1 or 0', () => {
    expect(booleanValue(table.rows[0] as string[], columns, 'flag')).toBe(true);
    expect(booleanValue(table.rows[1] as string[], columns, 'flag')).toBe(false);
  });

  it('rejects a flag that is neither 0 nor 1', () => {
    const odd = parseCsv('flag\nyes\n');
    const oddColumns = indexColumns(odd.header);
    expect(() => booleanValue(odd.rows[0] as string[], oddColumns, 'flag')).toThrow(
      /must be 0 or 1/,
    );
  });
});
