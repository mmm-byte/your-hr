'use client';

import { useEffect } from 'react';
import { ErrorState, RetryButton } from '@/components/product/error-state';

/**
 * The profile's error state (UI.md → States required on data surfaces).
 *
 * Plain language and a recovery action. The raw message is logged, never
 * rendered (AUD-004).
 */
export default function EmployeeProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Employee profile failed to load:', error);
  }, [error]);

  return (
    <ErrorState
      title="This employee could not be loaded"
      description="The profile could not be read. This is usually temporary — try again, and if it keeps happening contact support."
      retry={<RetryButton onRetry={reset} />}
    />
  );
}
