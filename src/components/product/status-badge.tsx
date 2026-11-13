import type { ReactNode } from 'react';

/**
 * Status badge (UI.md → Reusable product components).
 *
 * Status is never conveyed by colour alone (UI.md → Accessibility). Every
 * badge pairs its colour treatment with a text label, so the state is readable
 * without colour perception and by a screen reader.
 */
export type StatusTone = 'neutral' | 'positive' | 'caution' | 'critical';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  positive: 'bg-success-subtle text-success border-success/30',
  caution: 'bg-warning-subtle text-warning-foreground border-warning/30',
  critical: 'bg-danger-subtle text-danger border-danger/30',
};

export function StatusBadge({
  children,
  tone = 'neutral',
  prefix,
}: {
  children: ReactNode;
  tone?: StatusTone;
  /** Optional symbol that reinforces the state without relying on colour. */
  prefix?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {prefix ? (
        <span aria-hidden="true" className="leading-none">
          {prefix}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/**
 * The employment-status badge.
 *
 * Maps the seeded status values to a tone and a symbol, so the state is
 * communicated by text and shape as well as colour.
 */
export function EmploymentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <StatusBadge tone="positive" prefix="●">Active</StatusBadge>;
    case 'on_leave':
      return <StatusBadge tone="caution" prefix="◐">On leave</StatusBadge>;
    case 'terminated':
      return <StatusBadge tone="neutral" prefix="○">Terminated</StatusBadge>;
    default:
      return <StatusBadge>{status}</StatusBadge>;
  }
}
