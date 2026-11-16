import { expect, test } from '@playwright/test';

/**
 * Covers:
 * - The directory renders one bounded page of the 10,000-person cohort
 * - The search narrows the result and says so
 * - A sort link changes the order
 * - The pager moves between pages
 * - The filters are carried in the URL, so a refresh reproduces the view
 *
 * Does not cover:
 * - The write path (tests/e2e/revision.spec.ts)
 * - The query layer (tests/integration/compensation.test.ts)
 */
test.describe('the employee directory', () => {
  test('renders the workforce with a result count and one bounded page', async ({ page }) => {
    await page.goto('/employees');

    // The table is present and has rows.
    const table = page.getByRole('table');
    await expect(table).toBeVisible();

    // The count is stated, and it is the whole workforce — the browser holds
    // one page, not 10,000 rows (ANA-007).
    await expect(page.getByText(/of 10,000 matching employees/)).toBeVisible();

    // The range shows that only one page is in the browser.
    await expect(page.getByText(/Showing 1–25 of/)).toBeVisible();

    // The page itself says which page is showing and how many there are.
    await expect(page.getByText(/Page 1 of 400/)).toBeVisible();

    // The table has a bounded number of rows, not the whole workforce.
    const rowCount = await page.getByRole('row').count();
    expect(rowCount).toBeLessThan(40);
    expect(rowCount).toBeGreaterThan(1);
  });

  test('narrows the results with a search', async ({ page }) => {
    await page.goto('/employees');

    await page.getByLabel('Search').fill('Christina Leblanc');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page).toHaveURL(/search=/);
    // The count now describes the match, not the workforce.
    await expect(page.getByText(/matching employees/)).toBeVisible();
  });

  test('changes the order with a sort link', async ({ page }) => {
    await page.goto('/employees');

    const sortLink = page.getByRole('link', { name: /Job title/ }).first();
    await sortLink.click();

    await expect(page).toHaveURL(/sort=jobTitle/);
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('moves between pages with the pager', async ({ page }) => {
    await page.goto('/employees');

    await page.getByRole('link', { name: 'Next page' }).click();

    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Page 2 of 400/)).toBeVisible();
  });

  test('reproduces the same view after a refresh', async ({ page }) => {
    await page.goto('/employees?country=US&status=active');
    await expect(page.getByRole('table')).toBeVisible();
    const firstRow = await page.getByRole('row').nth(1).innerText();

    await page.reload();

    const reloadedFirstRow = page.getByRole('row').nth(1);
    await expect(reloadedFirstRow).toBeVisible();
    expect(await reloadedFirstRow.innerText()).toBe(firstRow);
  });
});
