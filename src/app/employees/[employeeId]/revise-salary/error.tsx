'use client';

import { useEffect } from 'react';
import { ErrorState, RetryButton } from '@/components/product/error-state';

/**
 * The revision page's error state (UI.md → States required on data
 * surfaces).
 *
 * A failed load explains itself in plain language and offers a way forward.
 * The raw message is logged, never rendered (AUD-004).
 */
export default function ReviseSalaryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('The salary revision form failed to load:', error);
  }, [error]);

  return (
    <ErrorState
      title="This salary revision could not be loaded"
      description="The employee's compensation could not be read. This is usually temporary — try again, and if it keeps happening contact support with the reference below."
      retry={<RetryButton onRetry={reset} />}
    />
  );
}
