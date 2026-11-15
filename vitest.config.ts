import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const resolve = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

/**
 * Three separate projects so the fast suites stay fast.
 *
 * - `unit`        pure domain rules, no DOM, no database
 * - `component`   React components with Testing Library, server actions mocked
 * - `integration` database behaviour against PGlite (D-009)
 *
 * `pnpm test` runs unit + component only. `pnpm test:integration` runs the
 * database project. Keeping them apart means the inner loop never waits on a
 * database, and a database failure is visibly separate from a logic failure.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          globals: false,
          setupFiles: ['tests/setup/unit.ts'],
        },
      },
      {
        // The React plugin is inherited from the root config, so it is not
        // repeated here (Vitest 5 warns about a duplicated plugin).
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['tests/component/**/*.test.tsx', 'tests/component/**/*.test.ts'],
          globals: false,
          setupFiles: ['tests/setup/component.ts'],
          // React Testing Library needs a clean document between tests.
          restoreMocks: true,
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          globals: false,
          setupFiles: ['tests/setup/integration.ts'],
          // A database test that leaks state is worse than no test.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve('./src'),
      // `server-only` throws when a module is imported outside a React
      // Server Component. A test is neither, so the marker is aliased to an
      // empty module: the guard is a build-time check against a browser
      // bundle, and it must not stop the server code being tested.
      'server-only': resolve('./tests/setup/empty.ts'),
    },
  },
});
