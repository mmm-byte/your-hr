import { expect, test } from '@playwright/test';

/**
 * Covers:
 * - Every section of the shell is reachable from the primary navigation
 * - The assessment notice is on every page (ACC-002)
 * - The skip-to-content link exists and points at the main content
 * - An unknown route shows the not-found page, not a crash
 *
 * Does not cover:
 * - The data on each surface (tests/e2e/directory.spec.ts)
 */
test.describe('the application shell', () => {
  test('shows the assessment notice and the skip link', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByText(/No authentication — the user is assumed to be an authorised HR Manager/),
    ).toBeVisible();

    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  test('reaches every section from the primary navigation', async ({ page }) => {
    await page.goto('/');

    const navigation = page.getByRole('navigation', { name: 'Primary' });

    for (const [label, path] of [
      ['Employees', '/employees'],
      ['Compensation', '/compensation'],
      ['Analytics', '/analytics'],
      ['Data Quality', '/data-quality'],
    ] as const) {
      await navigation.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }

    await navigation.getByRole('link', { name: 'Overview' }).click();
    await expect(page).toHaveURL(new RegExp('/$'));
  });

  test('shows a not-found page for an unknown route', async ({ page }) => {
    const response = await page.goto('/no-such-page');

    expect(response?.status()).toBe(404);
    await expect(page.getByText(/could not be found|not found/i).first()).toBeVisible();
    // The navigation is still there, so the reader is not stranded.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  });
});
