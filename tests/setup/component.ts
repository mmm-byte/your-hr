/**
 * Setup for the `component` Vitest project.
 *
 * Adds the jest-dom matchers so assertions can read as behaviour
 * (`expect(button).toBeDisabled()`) rather than as implementation detail
 * (`expect(button.getAttribute('aria-disabled')).toBe('true')`).
 *
 * The Next.js router is mocked, because the client components that write to
 * the URL — the filter bar, the reporting-date picker, the page-size selector
 * — all use `useRouter` and `useSearchParams`. The mock records each
 * navigation so a test can assert where the component sent the reader.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/** The navigations the component under test requested, in order. */
export const navigations: { href: string; method: 'push' | 'replace'; options: unknown }[] = [];

const record = (method: 'push' | 'replace') => (href: string, options?: unknown) => {
  navigations.push({ href, method, options });
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(record('push')),
    replace: vi.fn(record('replace')),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/employees',
  useParams: () => ({}),
}));

afterEach(() => {
  cleanup();
  navigations.length = 0;
});
