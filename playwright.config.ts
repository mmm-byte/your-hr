import { defineConfig, devices } from '@playwright/test';

/**
 * E2E configuration.
 *
 * `channel: 'chrome'` drives the Google Chrome already installed on the machine
 * instead of downloading Playwright's own Chromium build (D-010). That avoids a
 * ~500 MB download, which matters on a nearly-full disk, and keeps the suite
 * runnable without a separate browser-install step.
 *
 * The config file must be named `playwright.config.ts` — any other name is
 * silently ignored by the runner.
 *
 * The `globalSetup` seeds a PGlite database with the approved cohort, builds
 * the application, and starts it as a standalone server against that database
 * (D-009). A spec therefore exercises the real 10,000-person workforce, and
 * `pnpm test:e2e` needs no database server and no manual preparation.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3399',
    channel: 'chrome',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
