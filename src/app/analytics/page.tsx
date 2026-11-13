import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/product/empty-state';
import { PageHeader } from '@/components/product/page-header';

/**
 * Analytics (UX-JOURNEY.md §5).
 *
 * The predefined, decision-useful analytics — headcount by country, department
 * and status; median and average pay by valid grouping — are built in Phase 5.
 * The route exists now so the navigation map is complete.
 */
export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Headcount, median, and average compensation — always within a single currency."
      />
      <EmptyState
        icon={<Construction aria-hidden="true" className="size-5" />}
        title="Analytics are being populated"
        description="Headcount and compensation distributions appear here once the seeded workforce is loaded. Every figure states its currency, and every chart carries a text summary."
      />
    </>
  );
}
