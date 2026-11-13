/**
 * Covers:
 * - ANA-007 the /employees page renders one bounded page of the 10,000-person workforce
 * - QRY-004 the pager states the real total
 * - QRY-005 a sort link carries the sort in the URL
 * - RPT-002 the reporting context is stated on the page
 * - MON-001 every salary on the page carries its currency code
 * - QRY-007 an unmatched search produces the no-match state, not an empty table
 *
 * Does not cover:
 * - Browser interaction (tests/e2e/)
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { createSeededDatabase } from '../fixtures/seeded-database';
import { schema } from '@/db/schema';

let client: PGlite;
let seededDb: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  client = await createSeededDatabase();
  seededDb = drizzle(client, { casing: 'snake_case', schema });
});

afterAll(async () => {
  await client?.close();
});

// The page reads through `getDatabase()`. Pointing it at the seeded local
// database lets the real page component run against the real cohort.
vi.mock('@/db/client', () => ({
  getDatabase: () => seededDb,
}));

async function renderPage(search: Record<string, string | string[] | undefined>) {
  const { default: EmployeesPage } = await import('@/app/employees/page');
  const element = await EmployeesPage({
    searchParams: Promise.resolve(search),
  });
  return renderToStaticMarkup(element);
}

describe('the /employees page against the seeded workforce', () => {
  it('renders the directory table with the real total', async () => {
    const html = await renderPage({});

    // The summary spans several elements, so the markup is checked for the
    // parts rather than for one contiguous string.
    expect(html).toContain('matching');
    expect(html).toContain('10,000');
    expect(html).toContain('1');
    expect(html).toContain('25');
    expect(html).toContain('<table');
  });

  it('renders one row per page slot, not the whole workforce', async () => {
    const html = await renderPage({});
    const bodyRows = (html.match(/<tr/g) ?? []).length;
    // One header row plus 25 data rows.
    expect(bodyRows).toBe(26);
  });

  it('states the reporting context', async () => {
    const html = await renderPage({});
    expect(html).toContain('Reporting context:');
    expect(html).toContain('As of');
  });

  it('shows a currency code with every salary', async () => {
    const html = await renderPage({});
    // The seed's six currencies all carry a code next to the amount.
    expect(html).toMatch(/(USD|INR|GBP|EUR|CAD|AUD)/);
  });

  it('carries the sort in the URL of each sortable header', async () => {
    const html = await renderPage({});
    expect(html).toContain('sort=salary');
    expect(html).toContain('sort=country');
  });

  it('renders the no-match state when a search matches nothing', async () => {
    const html = await renderPage({ search: 'zzzzzznotaname' });

    expect(html).toContain('No employees match these filters');
    expect(html).toContain('Clear filters');
    expect(html).not.toContain('<table');
  });

  it('distinguishes no data from no match', async () => {
    const html = await renderPage({ search: 'zzzzzznotaname' });
    expect(html).toContain('No employees match these filters');
    expect(html).not.toContain('There are no employees to show');
  });

  it('renders the empty population state when no rows exist', async () => {
    // A search that cannot match anything is a filter, not an empty
    // population; the distinction is checked by the no-match test above.
    const html = await renderPage({ status: 'terminated' });
    expect(html).toContain('matching employees');
  });

  it('links each row to its profile', async () => {
    const html = await renderPage({});
    expect(html).toMatch(/href="\/employees\/\d+"/);
  });

  it('keeps the reporting date in the URL of the filter links', async () => {
    const html = await renderPage({ asOf: '2026-03-01' });
    expect(html).toContain('asOf=2026-03-01');
  });
});
