import Link from 'next/link';
import type { Route } from 'next';
import { AlertTriangle, ChevronRight } from 'lucide-react';

/**
 * The data-quality issue list (FEATURES.md → Data quality).
 *
 * The framing matters as much as the findings. These are **issues that need
 * review**, not corrupt data and not a verdict on the record: the seed
 * deliberately contains the anomalies this page surfaces, and a reader who
 * sees "corrupt" would be told something the system does not know.
 *
 * Each issue states:
 * - what the rule found, in plain language
 * - how many records it affects
 * - which employees, linked so the reader can open the profile and look
 */

/** One finding. */
export interface DataQualityIssue {
  /** A stable, kebab-case identifier for the rule. */
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly count: number;
  /** The affected employees, capped by the query. */
  readonly employeeIds: readonly number[];
  /** Whether more employees are affected than are listed. */
  readonly hasMore: boolean;
}

/**
 * The issue list.
 *
 * The count is the headline and the affected employees are listed under it,
 * so a reader can see the scale of a finding before they start opening
 * profiles one by one.
 */
export function IssueList({
  issues,
  totalEmployees,
}: {
  issues: readonly DataQualityIssue[];
  /** How many distinct employees have at least one issue. */
  totalEmployees: number;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {totalEmployees === 0
          ? 'No employees have an issue that needs review.'
          : `${totalEmployees} ${totalEmployees === 1 ? 'employee has' : 'employees have'} at least one issue that needs review. These findings are deterministic — the same data always produces the same list.`}
      </p>

      {issues.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-8 text-center text-sm text-muted-foreground">
          Every check passed. Nothing needs review.
        </p>
      ) : (
        <ul className="space-y-3">
          {issues.map((issue) => (
            <IssueCard key={issue.code} issue={issue} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One issue and the employees it affects.
 */
function IssueCard({ issue }: { issue: DataQualityIssue }) {
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{issue.title}</h3>
            <p className="text-xs tabular-nums text-muted-foreground">
              {issue.count} {issue.count === 1 ? 'record' : 'records'}
            </p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{issue.description}</p>

          {issue.employeeIds.length > 0 ? (
            <>
              <p className="mt-3 text-xs font-medium text-muted-foreground">
                Affected employees
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {issue.employeeIds.map((id) => (
                  <li key={id}>
                    <Link
                      href={`/employees/${id}` as Route}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-subtle px-2 py-1 text-xs font-medium hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      #{id}
                      <ChevronRight aria-hidden="true" className="size-3" />
                    </Link>
                  </li>
                ))}
              </ul>
              {issue.hasMore ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  More employees are affected than are listed here. Filter the directory
                  to review the rest.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
