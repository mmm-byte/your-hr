import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/product/empty-state';
import { PageHeader } from '@/components/product/page-header';

/**
 * Data quality (UX-JOURNEY.md §5).
 *
 * The deterministic issue work queue — categories with counts, expandable to
 * affected employees — is built in Phase 5. The route exists now so the
 * navigation map is complete.
 */
export default function DataQualityPage() {
  return (
    <>
      <PageHeader
        title="Data Quality"
        description="Deterministic findings that need review — currency mismatches, incomplete records, and history anomalies."
      />
      <EmptyState
        icon={<Construction aria-hidden="true" className="size-5" />}
        title="No issues have been checked yet"
        description="Findings appear here once the seeded workforce has been verified. Issues are labelled as needing review, not as corrupt data."
      />
    </>
  );
}
