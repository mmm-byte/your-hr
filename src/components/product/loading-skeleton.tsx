/**
 * Loading skeleton (UI.md → States required on data surfaces).
 *
 * A skeleton that matches the shape of the content it replaces, rather than a
 * full-page spinner. The reader sees a table where a table is coming, so the
 * layout does not jump when the data arrives.
 *
 * The skeleton is purely decorative: it is hidden from assistive technology
 * with `aria-hidden`, because the loading state is already announced by the
 * route's `aria-busy` container.
 */
export function LoadingSkeleton({
  className,
  rows = 8,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div aria-hidden="true" className={className}>
      <div className="animate-pulse space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="h-9 rounded bg-muted"
            style={{ opacity: 1 - index * 0.07 }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A skeleton shaped like the employee directory table.
 */
export function DirectorySkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-10 animate-pulse rounded bg-muted" />
      <LoadingSkeleton rows={rows} />
    </div>
  );
}
