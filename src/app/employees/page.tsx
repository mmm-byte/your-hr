import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/product/empty-state';
import { PageHeader } from '@/components/product/page-header';

/**
 * Employee directory (UX-JOURNEY.md §5).
 *
 * The directory itself — server-side search, filters, sort, pagination, and the
 * results table — is built in Phase 3 once the workforce query exists. The
 * route exists now so the navigation map is complete and `typedRoutes` can
 * verify every link.
 */
export default function EmployeesPage() {
  return (
    <>
      <PageHeader
        title="Employees"
        description="Search and filter the 10,000-person workforce, then open a profile to review compensation history."
      />
      <EmptyState
        icon={<Construction aria-hidden="true" className="size-5" />}
        title="The directory is being populated"
        description="Search, filters, sorting, and pagination appear here once the seeded workforce is loaded."
      />
    </>
  );
}
