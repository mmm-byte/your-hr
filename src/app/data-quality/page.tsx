import type { Metadata } from 'next';
import { getDatabase } from '@/db/client';
import { queryDataQualityIssues } from '@/db/queries/compensation';
import { EmptyState } from '@/components/product/empty-state';
import { IssueList } from '@/components/product/issue-list';
import { PageHeader } from '@/components/product/page-header';

export const metadata: Metadata = {
  title: 'Data Quality',
};
/**
 * This page reads the database at request time.
 *
 * The build must never need a database, so the page is rendered on demand
 * rather than prerendered (the CI job sets no `DATABASE_URL` and must still
 * build — ENVIRONMENT.md → Build).
 */
export const dynamic = 'force-dynamic';


/**
 * The data-quality work queue (UX-JOURNEY.md §5, FEATURES.md → Data quality,
 * Phase 5 item 5.4).
 *
 * A **server component**: the findings are computed by deterministic SQL
 * rules, so the same data always produces the same list. A reader can come
 * back tomorrow and see the same findings, and a rule that changed its mind
 * overnight would be a bug, not an update.
 *
 * The framing is deliberate: these are **issues that need review**, not
 * corrupt data. The seed deliberately contains the anomalies this page
 * surfaces, and a reader who saw the word "corrupt" would be told something
 * the system does not know.
 */
export default async function DataQualityPage() {
  const db = getDatabase();
  const result = await queryDataQualityIssues(db, {});

  const hasIssues = result.issues.some((issue) => issue.count > 0);

  return (
    <>
      <PageHeader
        title="Data Quality"
        description="Deterministic findings that need review — completeness, currency policy, and history anomalies."
      />

      <div className="space-y-5">
        {hasIssues ? (
          <IssueList issues={result.issues} totalEmployees={result.affectedEmployees} />
        ) : (
          <EmptyState
            title="Every check passed"
            description="No record in the workforce has an issue that needs review. The checks run again on every visit, and the same data always produces the same result."
          />
        )}
      </div>
    </>
  );
}
