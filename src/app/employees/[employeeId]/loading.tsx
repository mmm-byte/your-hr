import { LoadingSkeleton } from '@/components/product/loading-skeleton';
import { PageHeader } from '@/components/product/page-header';

/**
 * The profile's loading state (UI.md → States required on data surfaces).
 *
 * A skeleton shaped like the profile's sections, so the layout does not jump
 * when the employee is read.
 */
export default function EmployeeProfileLoading() {
  return (
    <>
      <PageHeader title="Loading employee…" />
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-lg bg-muted" />
          <div className="h-56 animate-pulse rounded-lg bg-muted" />
        </div>
        <LoadingSkeleton rows={4} />
      </div>
    </>
  );
}
