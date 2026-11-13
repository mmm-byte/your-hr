import { DirectorySkeleton } from '@/components/product/loading-skeleton';
import { PageHeader } from '@/components/product/page-header';

/**
 * The directory's loading state (UI.md → States required on data surfaces).
 *
 * A skeleton that matches the shape of the content it replaces, rather than a
 * full-page spinner, so the layout does not jump when the rows arrive.
 */
export default function EmployeesLoading() {
  return (
    <>
      <PageHeader title="Employees" description="Loading the workforce…" />
      <DirectorySkeleton rows={10} />
    </>
  );
}
