/**
 * Setup for the `unit` Vitest project.
 *
 * The unit suite tests pure domain rules, so there is nothing to configure here
 * beyond a guard that keeps the suite honest.
 *
 * Deliberately does NOT install fake timers globally. A test that needs a fixed
 * clock installs it itself, so the reason is visible at the call site rather
 * than hidden in shared setup.
 */
import { beforeAll } from 'vitest';

beforeAll(() => {
  // Fail loudly if a unit test accidentally imports the database layer.
  // The unit project must stay dependency-free and run in milliseconds.
  if (process.env.VITEST_UNIT_FORBID_DB === '1') {
    throw new Error('Unit project must not import the database layer.');
  }
});
