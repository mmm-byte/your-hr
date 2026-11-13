/**
 * CSV reader for the approved seed files.
 *
 * Purpose: turn the two seed CSVs into typed rows without adding a
 * dependency. Node has no built-in CSV parser and the files contain quoted
 * fields with embedded commas (`"Associate, Mid-Market Sales"`), so a
 * correct reader is required rather than a `split(',')`.
 * Called by: scripts/seed.ts and scripts/verify.ts.
 * Reads: the files in Dataset/.
 * Rules: DATASET.md (deterministic import, no invented values).
 * Tests: tests/unit/csv.test.ts.
 *
 * The reader implements RFC 4180 quoting: a field may be wrapped in double
 * quotes, and `""` inside a quoted field is a literal double quote.
 * Newlines inside a quoted field are preserved.
 */

/** A parsed CSV file: a header row plus data rows. */
export interface CsvTable {
  readonly header: readonly string[];
  readonly rows: readonly string[][];
}

/**
 * Parse CSV text into a header and rows.
 *
 * @throws when a row has a different field count than the header, because a
 * ragged CSV means the file was truncated or altered and the seed must not
 * proceed on a misaligned file.
 */
export function parseCsv(text: string): CsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;

  const endField = () => {
    row.push(field);
    field = '';
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] as string;

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (fieldStarted) {
        throw new Error('Invalid CSV: a quote appeared in the middle of an unquoted field.');
      }
      inQuotes = true;
      fieldStarted = true;
      continue;
    }

    if (char === ',') {
      endField();
      continue;
    }

    if (char === '\n') {
      endRow();
      continue;
    }

    if (char === '\r') {
      // A lone CR is treated as part of the line ending; CRLF pairs are
      // handled by skipping the CR here and consuming the LF next.
      continue;
    }

    field += char;
    fieldStarted = true;
  }

  if (inQuotes) {
    throw new Error('Invalid CSV: the file ends inside a quoted field.');
  }

  // A trailing newline leaves one empty pending row; ignore it.
  if (field !== '' || row.length > 0) {
    endRow();
  }

  const header = rows.shift();
  if (!header || header.length === 0) {
    throw new Error('Invalid CSV: the file has no header row.');
  }

  for (const [index, dataRow] of rows.entries()) {
    if (dataRow.length !== header.length) {
      throw new Error(
        `Invalid CSV: row ${index + 2} has ${dataRow.length} fields but the header has ${header.length}.`,
      );
    }
  }

  return { header, rows };
}

/**
 * Index a CSV header by column name.
 *
 * @throws when a required column is absent, so a renamed source column
 * fails loudly at the point of use rather than silently reading blanks.
 */
export function indexColumns(header: readonly string[]): ReadonlyMap<string, number> {
  const index = new Map<string, number>();
  header.forEach((name, position) => {
    if (!index.has(name)) {
      index.set(name, position);
    }
  });
  return index;
}

/**
 * Read one column from a row.
 *
 * @throws when the column is not part of the file.
 */
export function cell(row: readonly string[], columns: ReadonlyMap<string, number>, name: string): string {
  const position = columns.get(name);
  if (position === undefined) {
    throw new Error(`Missing required column "${name}".`);
  }
  return row[position] ?? '';
}

/**
 * Read an optional column, returning `undefined` when the column is absent.
 */
export function optionalCell(
  row: readonly string[],
  columns: ReadonlyMap<string, number>,
  name: string,
): string | undefined {
  const position = columns.get(name);
  if (position === undefined) {
    return undefined;
  }
  return row[position] ?? '';
}

/** A trimmed cell that must not be empty. */
export function requiredValue(
  row: readonly string[],
  columns: ReadonlyMap<string, number>,
  name: string,
): string {
  const value = cell(row, columns, name).trim();
  if (value === '') {
    throw new Error(`Required column "${name}" is empty.`);
  }
  return value;
}

/**
 * A trimmed cell that may be empty, returned as `null`.
 *
 * An empty source cell means "the source has no value", which is different
 * from the value zero (D-019).
 */
export function nullableValue(
  row: readonly string[],
  columns: ReadonlyMap<string, number>,
  name: string,
): string | null {
  const value = cell(row, columns, name).trim();
  return value === '' ? null : value;
}

/**
 * A cell that must be a whole number.
 *
 * @throws when the value is not an integer.
 */
export function integerValue(
  row: readonly string[],
  columns: ReadonlyMap<string, number>,
  name: string,
): number {
  const raw = requiredValue(row, columns, name);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Column "${name}" must be a whole number, got "${raw}".`);
  }
  return parsed;
}

/**
 * A cell that must be a whole number or empty.
 */
export function nullableIntegerValue(
  row: readonly string[],
  columns: ReadonlyMap<string, number>,
  name: string,
): number | null {
  const raw = nullableValue(row, columns, name);
  if (raw === null) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Column "${name}" must be a whole number, got "${raw}".`);
  }
  return parsed;
}

/**
 * A cell that must be a decimal string, returned unchanged.
 *
 * The value is kept as a string so it can be handed to PostgreSQL's
 * `numeric` column without passing through a JavaScript `number` (MON-002).
 */
export function decimalValue(
  row: readonly string[],
  columns: ReadonlyMap<string, number>,
  name: string,
): string {
  const raw = requiredValue(row, columns, name);
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Column "${name}" must be a decimal number, got "${raw}".`);
  }
  return raw;
}

/**
 * A cell that must be a decimal string or empty.
 */
export function nullableDecimalValue(
  row: readonly string[],
  columns: ReadonlyMap<string, number>,
  name: string,
): string | null {
  const raw = nullableValue(row, columns, name);
  if (raw === null) {
    return null;
  }
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Column "${name}" must be a decimal number, got "${raw}".`);
  }
  return raw;
}

/**
 * A cell that holds a boolean flag, returned as a boolean.
 *
 * The source writes these flags as `1`/`0` in some columns and as
 * `1.0`/`0.0` in others, so both spellings are accepted. A value that is
 * neither is rejected rather than coerced, because a silently mistyped flag
 * would become a wrong attrition record.
 */
export function booleanValue(
  row: readonly string[],
  columns: ReadonlyMap<string, number>,
  name: string,
): boolean {
  const raw = requiredValue(row, columns, name);
  if (raw === '1' || raw === '1.0') {
    return true;
  }
  if (raw === '0' || raw === '0.0') {
    return false;
  }
  throw new Error(`Column "${name}" must be 0 or 1, got "${raw}".`);
}
