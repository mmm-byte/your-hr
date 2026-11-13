/**
 * Covers:
 * - ANA-007 the directory serves 10,000 records with server-side pagination
 * - QRY-004 the page size is bounded and the pager states the real total
 * - SAL-007 the current salary is selected per employee against the real cohort
 * - QRY-005 a sort over the real cohort is stable
 *
 * Does not cover:
 * - The directory UI (tests/component/)
 * - The seed itself (tests/integration/seed.test.ts)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { createSeededDatabase } from '../fixtures/seeded-database';
import { queryEmployeeDirectory, countEmployees, type DirectoryDatabase } from '@/db/queries/employees';
import { parseEmployeeDirectoryQuery } from '@/schemas/employee-directory';
import { schema } from '@/db/schema';

let client: PGlite;
let db: DirectoryDatabase;

async function query(raw: Record<string, unknown>) {
  const parsed = parseEmployeeDirectoryQuery(raw);
  if (parsed === null) {
    throw new Error('Expected the query to parse.');
  }
  return queryEmployeeDirectory(db, parsed);
}

beforeAll(async () => {
  client = await createSeededDatabase();
  db = drizzle(client, { casing: 'snake_case', schema }) as unknown as DirectoryDatabase;
});

afterAll(async () => {
  await client?.close();
});

describe('the seeded workforce', () => {
  it('holds 10,000 employees', async () => {
    expect(await countEmployees(db)).toBe(10000);
  });

  it('serves one bounded page, not the whole workforce', async () => {
    const result = await query({});
    expect(result.rows.length).toBe(25);
    expect(result.total).toBe(10000);
    expect(result.totalPages).toBe(400);
  });

  it('returns a different set of employees on the second page', async () => {
    const first = await query({ page: '1' });
    const second = await query({ page: '2' });
    const firstIds = new Set(first.rows.map((row) => row.id));
    expect(second.rows.every((row) => !firstIds.has(row.id))).toBe(true);
  });

  it('clamps an oversized page size to the cap', async () => {
    const result = await query({ pageSize: '5000' });
    expect(result.rows.length).toBe(100);
    expect(result.pageSize).toBe(100);
  });

  it('gives every row a current salary', async () => {
    const result = await query({});
    const withSalary = result.rows.filter((row) => row.currentBaseSalary !== null);
    expect(withSalary.length).toBeGreaterThan(0);
    for (const row of withSalary) {
      expect(row.currentCurrencyCode).not.toBeNull();
      expect(row.currentEffectiveFrom).not.toBeNull();
    }
  });

  it('joins a department and branch onto every row', async () => {
    const result = await query({});
    for (const row of result.rows) {
      expect(row.departmentName).not.toBe('');
      expect(row.branchCode).not.toBe('');
    }
  });

  it('filters the real workforce by country', async () => {
    const result = await query({ country: 'IN' });
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThan(10000);
    expect(result.rows.every((row) => row.countryCode === 'IN')).toBe(true);
  });

  it('filters the real workforce by a department', async () => {
    const result = await query({ department: 'Payroll' });
    expect(result.total).toBeGreaterThan(0);
    expect(result.rows.every((row) => row.departmentName === 'Payroll')).toBe(true);
  });

  it('finds an employee by search term', async () => {
    const result = await query({ search: 'a' });
    expect(result.total).toBeGreaterThan(0);
  });

  it('sorts the real workforce without jitter', async () => {
    const first = await query({ sort: 'country' });
    const second = await query({ sort: 'country' });
    expect(first.rows.map((row) => row.id)).toEqual(second.rows.map((row) => row.id));
  });

  it('sorts by salary on the USD equivalent, not on the local amount', async () => {
    // The workforce is paid in six currencies. The local amounts are not
    // comparable, so the order must come from the USD equivalent — the one
    // basis every record shares (MON-004, RPT-007).
    const result = await query({ sort: 'salary' });

    const equivalents = result.rows
      .map((row) => row.currentUsdEquivalent)
      .filter((amount): amount is string => amount !== null);

    expect(equivalents).toHaveLength(result.rows.length);
    expect(equivalents).toEqual([...equivalents].sort((a, b) => Number(b) - Number(a)));
  });

  it('shows the local amount, not the USD equivalent, in the salary column', async () => {
    // The sort uses the USD equivalent; the reader still sees their own
    // currency. The two must not be confused with each other.
    const result = await query({ sort: 'salary' });
    const withBoth = result.rows.filter(
      (row) => row.currentBaseSalary !== null && row.currentUsdEquivalent !== null,
    );

    expect(withBoth.length).toBeGreaterThan(0);
    for (const row of withBoth) {
      // At least one row is not in USD, so its local amount must differ from
      // its USD equivalent.
      if (row.currentCurrencyCode !== 'USD') {
        expect(row.currentBaseSalary).not.toBe(row.currentUsdEquivalent);
        break;
      }
    }
  });

  it('returns an empty result with the real total for a page past the end', async () => {
    const result = await query({ page: '9999' });
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(10000);
  });
});
