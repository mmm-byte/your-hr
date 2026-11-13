import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Error state (UI.md → States required on data surfaces).
 *
 * A failed data load must explain itself in plain language and offer a way
 * forward. It never shows a stack trace, a SQL fragment, or a database
 * message (AUD-004) — those leak internals and tell the reader nothing they
 * can act on.
 *
 * The correlation ID is the **only** diagnostic handle a user gets, so it is
 * shown when one is available.
 */
export function ErrorState({
  title = 'Something went wrong',
  description,
  correlationId,
  retry,
}: {
  title?: string;
  description?: string;
  correlationId?: string;
  /** Renders a retry control when the surface can recover. */
  retry?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-danger/30 bg-danger-subtle px-6 py-8"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle aria-hidden="true" className="size-5 text-danger" />
        <p className="text-sm font-medium">{title}</p>
      </div>

      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}

      {retry ? <div className="pt-1">{retry}</div> : null}

      {correlationId ? (
        <p className="text-xs text-muted-foreground">
          Reference: <span className="font-mono">{correlationId}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * A retry button for a failed data load.
 *
 * A plain button rather than a link: retrying re-runs the request, it does not
 * navigate anywhere.
 */
export function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <RotateCcw aria-hidden="true" className="size-4" />
      Try again
    </button>
  );
}
