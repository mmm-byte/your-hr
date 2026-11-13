import type { ReactNode } from 'react';

/**
 * Empty state (UI.md → Reusable product components).
 *
 * Used for both "there is no data" and "no rows match these filters". The
 * distinction is explicit: a viewer must never have to guess whether the
 * system is broken or the filter is too narrow (QRY-007).
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-subtle px-6 py-14 text-center">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

/**
 * No-match empty state.
 *
 * Distinct copy from the no-data state: it names the filters and offers a way
 * back.
 */
export function NoMatchState({
  description,
  action,
}: {
  description: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      title="No employees match these filters"
      description={description}
      action={action}
    />
  );
}
