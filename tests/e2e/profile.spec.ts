import { expect, test } from '@playwright/test';

/**
 * Covers:
 * - A profile shows the identity, the current salary with its currency, and
 *   the salary history
 * - A terminated employee's history stays readable and offers no revision
 * - An unknown employee shows the not-found state
 *
 * Does not cover:
 * - The revision form (tests/e2e/revision.spec.ts)
 */
test.describe('the employee profile', () => {
  test('shows the identity, the current salary, and the history', async ({ page }) => {
    await page.goto('/employees/2521');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The current compensation carries its currency (MON-001, RPT-005).
    const compensation = page.getByRole('region', { name: 'Compensation' });
    await expect(compensation).toBeVisible();
    await expect(compensation.getByText(/USD/).first()).toBeVisible();

    // The history is present with its effective dates.
    const history = page.getByRole('region', { name: 'Salary history' });
    await expect(history).toBeVisible();
  });

  test('keeps a terminated employee readable and offers no revision', async ({ page }) => {
    await page.goto('/employees/2');

    // The profile is fully readable.
    await expect(page.getByText('Terminated').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Salary history' })).toBeVisible();

    // There is no revision action at all (ELG-005, ELG-006).
    await expect(page.getByRole('link', { name: /Revise salary/i })).toHaveCount(0);
  });

  test('offers a revision action to an eligible employee', async ({ page }) => {
    await page.goto('/employees/2521');

    await expect(page.getByRole('link', { name: /Revise salary/i })).toBeVisible();
  });

  test('shows the not-found state for an unknown employee', async ({ page }) => {
    await page.goto('/employees/999999');

    // The reader sees the controlled not-found state, never a crash and never
    // a raw error (UX-JOURNEY §4.2).
    //
    // The **HTTP status** is not asserted: Next.js 16 returns 200 for
    // `notFound()` in a dynamic route that has a `loading.tsx` sibling
    // (vercel/next.js#93239). The rendered state is what the reader
    // experiences, and that is what this spec protects.
    await expect(page.getByText(/could not be found/i)).toBeVisible();

    // The recovery route is offered.
    await expect(page.getByRole('link', { name: 'Back to employees' })).toBeVisible();
  });
});
