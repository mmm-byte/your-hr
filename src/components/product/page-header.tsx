import type { ReactNode } from 'react';

/**
 * Page header (UI.md → Reusable product components).
 *
 * Every page starts with a title and a reporting context line. The context is
 * stated in words so the reader always knows which date the numbers describe
 * (RPT-002).
 */
export function PageHeader({
  title,
  description,
  context,
  actions,
}: {
  title: string;
  description?: string;
  context?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {context ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Reporting context:</span> {context}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
