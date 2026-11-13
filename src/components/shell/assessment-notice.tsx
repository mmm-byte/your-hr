import { Info } from 'lucide-react';

/**
 * Assessment notice (ACC-002).
 *
 * The application has no authentication layer (D-006) and runs on synthetic
 * data. Stating that on every page is honesty, not decoration: a reviewer must
 * not have to infer whether the environment is a production system.
 *
 * It is deliberately not dismissible — a notice that can be hidden forever
 * stops being a disclosure.
 */
export function AssessmentNotice() {
  return (
    <div
      role="note"
      className="border-b border-warning/30 bg-warning-subtle px-4 py-2 text-sm text-warning-foreground"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-2">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p className="leading-relaxed">
          <span className="font-semibold">Assessment environment.</span> Synthetic workforce data.
          No authentication — the user is assumed to be an authorised HR Manager.
        </p>
      </div>
    </div>
  );
}
