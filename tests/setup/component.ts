/**
 * Setup for the `component` Vitest project.
 *
 * Adds the jest-dom matchers so assertions can read as behaviour
 * (`expect(button).toBeDisabled()`) rather than as implementation detail
 * (`expect(button.getAttribute('aria-disabled')).toBe('true')`).
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
