import { expect, test } from '@playwright/test';

/**
 * Covers:
 * - The compensation view states its aggregates per currency and never in one
 *   blended number (MON-004, RPT-007)
 * - The analytics view answers the question the URL asks, and the grouping
 *   options narrow to what the metric supports (QRY-003)
 * - The data-quality view lists its findings with the affected employees
 *   linked
 * - The overview states the workforce split by status (ANA-001, ANA-002)
 *
 * Does not cover:
 * - The aggregate arithmetic (tests/integration/compensation.test.ts)
 */
test.describe('the analytics surfaces', () => {
  test('groups the compensation aggregates by currency', async ({ page }) => {
    await page.goto('/compensation');

    const aggregates = page.getByRole('region', { name: 'Aggregates by currency' });
    await expect(aggregates).toBeVisible();

    // Every currency has its own block, each stating its currency and its
    // sample size.
    await expect(aggregates.getByText('USD', { exact: true })).toBeVisible();
    await expect(aggregates.getByText('INR', { exact: true })).toBeVisible();

    // No figure claims a currency it does not have.
    const text = await aggregates.innerText();
    expect(text).not.toMatch(/Total/i);
  });

  test('answers the question the URL asks', async ({ page }) => {
    await page.goto('/analytics?metric=headcount&groupBy=country');

    await expect(page.getByRole('heading', { name: 'Headcount by Country' }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Headcount by country' })).toBeVisible();
  });

  test('narrows the grouping options to what the metric supports', async ({ page }) => {
    await page.goto('/analytics?metric=salaryDistribution&groupBy=jobLevel');

    const grouping = page.getByLabel('Group by');
    await expect(grouping.locator('option')).toHaveCount(1);
    await expect(grouping.locator('option')).toHaveText('Job level');
  });

  test('gives every chart a text summary and a table alternative', async ({ page }) => {
    await page.goto('/analytics?metric=headcount&groupBy=country');

    // The chart names itself, so a screen reader knows what it is.
    const chart = page.locator('[role="img"]').first();
    await expect(chart).toBeVisible();
    await expect(chart).toHaveAttribute('aria-label', /Headcount by Country/);

    // The same figures are in a list, not only in the chart (D-036).
    const panel = page.getByRole('region', { name: 'Headcount by Country' });
    await expect(panel.getByRole('listitem').first()).toBeVisible();
  });

  test('lists the data-quality findings with the affected employees linked', async ({ page }) => {
    await page.goto('/data-quality');

    await expect(page.getByRole('heading', { name: 'No absence summary' })).toBeVisible();

    // The affected employees are links, so a reader can open one.
    const links = page.getByRole('main').getByRole('link');
    await expect(links.first()).toBeVisible();
  });

  test('states the workforce split by status on the overview', async ({ page }) => {
    await page.goto('/');

    const workforce = page.getByRole('region', { name: 'Workforce size' });
    await expect(workforce).toBeVisible();
    await expect(workforce.getByText('Active')).toBeVisible();
    await expect(workforce.getByText('Terminated')).toBeVisible();

    // The counts are separate, so a reader knows which population a figure
    // describes (ANA-001).
    await expect(workforce.getByText('Total headcount')).toBeVisible();
  });
});
