'use client';

import { useEffect } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';

/**
 * Root error boundary (AUD-004).
 *
 * Any unexpected failure in a server component renders this. The message is
 * plain language, the stack trace stays server-side, and the user gets a
 * retry. `reset()` re-renders the segment, which is the correct recovery for a
 * transient failure.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side logging captures the real cause. The browser only receives
    // the digest, so nothing sensitive is exposed here.
    console.error('Unhandled application error', { digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="flex flex-col items-start gap-4">
        <span className="flex size-11 items-center justify-center rounded-lg bg-danger-subtle">
          <TriangleAlert aria-hidden="true" className="size-5 text-danger" />
        </span>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            The request could not be completed. This is usually temporary — try again.
          </p>
          {error.digest ? (
            <p className="text-xs text-muted-foreground">
              Reference: <code className="font-mono">{error.digest}</code>
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
