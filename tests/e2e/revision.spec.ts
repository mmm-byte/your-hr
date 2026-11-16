import { expect, test } from '@playwright/test';

/**
 * Covers:
 * - The revision form loads with the current salary read-only and the
 *   currency fixed (ELG-004)
 * - An invalid amount is refused with a field error and nothing is written
 * - A valid revision is written and confirmed (SAL-002…SAL-010)
 * - The live comparison states the change in words
 *
 * Does not cover:
 * - The transaction and the audit trail (tests/integration/salary-revision.test.ts)
 * - The concurrency conflict (tests/integration/salary-revision.test.ts)
 */

/**
 * The employee the revision specs write to.
 *
 * A seeded cohort member with no prior application revision, so the spec
 * never collides with another spec's write. The suite runs with one worker,
 * so the writes are serialised.
 */
const EMPLOYEE_ID = 2521;

test.describe('the salary revision', () => {
  test('shows the current salary read-only and the currency fixed', async ({ page }) => {
    await page.goto(`/employees/${EMPLOYEE_ID}/revise-salary`);

    const current = page.getByRole('region', { name: 'Current salary' });
    await expect(current).toBeVisible();

    // The currency is displayed and cannot be edited (ELG-004).
    const currency = page.getByLabel('Currency');
    await expect(currency).toHaveValue('USD');
    await expect(currency).toHaveAttribute('readonly', '');
  });

  test('states the change in words, not by colour alone', async ({ page }) => {
    await page.goto(`/employees/${EMPLOYEE_ID}/revise-salary`);

    await page.getByLabel('Base salary').fill('81000.00');

    // The direction is a word, not only an arrow.
    await expect(page.getByText('Increase of')).toBeVisible();
    await expect(page.getByText(/\(\+[\d.]+%\)/)).toBeVisible();
  });

  test('refuses an invalid amount and writes nothing', async ({ page }) => {
    await page.goto(`/employees/${EMPLOYEE_ID}/revise-salary`);

    await page.getByLabel('Base salary').fill('100.123');
    await page.getByLabel('Reason').fill('A market adjustment.');
    await page.getByRole('button', { name: 'Add salary revision' }).click();

    // The field error is shown beside the field.
    await expect(page.getByText('Enter an amount with at most two decimal places.')).toBeVisible();
    // Nothing was written.
    await expect(page.getByText('Nothing was saved')).toBeVisible();
  });

  test('writes a valid revision and confirms it', async ({ page }) => {
    await page.goto(`/employees/${EMPLOYEE_ID}/revise-salary`);

    const effectiveFrom = '2026-12-01';
    await page.getByLabel('Base salary').fill('81000.00');
    await page.getByLabel('Effective from').fill(effectiveFrom);
    await page.getByLabel('Reason').fill('Market adjustment for the platform team.');
    await page.getByRole('button', { name: 'Add salary revision' }).click();

    // The success confirmation states the new version (CON-003).
    await expect(page.getByText('The salary revision was added.')).toBeVisible();
    await expect(page.getByText(/compensation is now at version/)).toBeVisible();

    // The new record is on the profile, scheduled rather than current
    // (SAL-008).
    await page.goto(`/employees/${EMPLOYEE_ID}`);
    await expect(page.getByRole('region', { name: 'Salary history' })).toContainText('Scheduled');
  });
});
