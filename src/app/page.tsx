import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/product/empty-state';
import { PageHeader } from '@/components/product/page-header';

/**
 * Overview page (D-012).
 *
 * `/` **is** Overview. There is deliberately no `/overview` route and no
 * redirect to one — a second URL for the same page would make shared links
 * ambiguous and would contradict the route map in `docs/UX-JOURNEY.md` §2.
 *
 * The overview content is built in Phase 3, once the workforce queries exist.
 * Until then the route renders the shell with an explicit "not yet populated"
 * state — never a broken screen and never a silent blank page.
 */
export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Workforce size, compensation context, and data-quality attention for the multinational workforce."
      />
      <EmptyState
        icon={<Construction aria-hidden="true" className="size-5" />}
        title="The overview is being populated"
        description="Workforce and compensation summaries appear here once the seeded workforce is loaded. The application shell, navigation, and assessment notice are already in place."
      />
    </>
  );
}
