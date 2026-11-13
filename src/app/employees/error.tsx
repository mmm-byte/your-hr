'use client';

import { useEffect } from 'react';
import { ErrorState, RetryButton } from '@/components/product/error-state';

/**
 * The directory's error state (UI.md → States required on data surfaces).
 *
 * A failed load must explain itself in plain language and offer a way
 * forward. It never shows a stack trace or a database message (AUD-004).
 *
 * `reset` re-runs the server render, which is the recovery action for a
 * transient failure — the reader does not have to reload the page by hand.
 */
export default function EmployeesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The message is logged, not rendered: the user gets plain language and
    // the server log keeps the detail (AUD-004).
    console.error('Employee directory failed to load:', error);
  }, [error]);

  return (
    <ErrorState
      title="The employee directory could not be loaded"
      description="The workforce could not be read. This is usually temporary — try again, and if it keeps happening contact support with the reference below."
      retry={<RetryButton onRetry={reset} />}
    />
  );
}
