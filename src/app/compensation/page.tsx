import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/product/empty-state';
import { PageHeader } from '@/components/product/page-header';

/**
 * Compensation view (UX-JOURNEY.md §5).
 *
 * The filterable current-salary population and its currency-grouped aggregates
 * are built in Phase 5. The route exists now so the navigation map is complete.
 */
export default function CompensationPage() {
  return (
    <>
      <PageHeader
        title="Compensation"
        description="Current salary population and currency-grouped aggregates across the workforce."
      />
      <EmptyState
        icon={<Construction aria-hidden="true" className="size-5" />}
        title="Compensation data is being populated"
        description="Aggregates appear here once the seeded workforce is loaded. Every total is grouped by currency — currencies are never summed together."
      />
    </>
  );
}
