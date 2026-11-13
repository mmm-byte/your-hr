import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * ESLint flat configuration.
 *
 * `eslint-config-next` v16 exports flat config arrays directly, so the configs
 * are spread in rather than bridged through `FlatCompat`. The compat bridge
 * fails with "Converting circular structure to JSON" because it tries to
 * serialise the React plugin twice.
 *
 * `next/core-web-vitals` includes the React and hooks rules; `next/typescript`
 * adds the TypeScript-aware rules.
 */
const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'drizzle/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Type-aware rules need the TypeScript program. `projectService` lets
    // ESLint find the nearest tsconfig for each file, so no manual
    // `project` globs are needed as the project grows.
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Unused variables are a real signal, not noise. The `_` prefix is the
      // conventional escape for an intentionally unused binding.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // A floating promise in a server component or route handler is a bug:
      // the response can be sent before the write completes.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // `any` defeats the point of TypeScript strict mode.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      // Test files legitimately use non-null assertions for fixtures.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];

export default config;
