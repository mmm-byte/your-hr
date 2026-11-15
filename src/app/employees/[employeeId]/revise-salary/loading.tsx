import { LoadingSkeleton } from '@/components/product/loading-skeleton';
import { PageHeader } from '@/components/product/page-header';

/**
 * The revision page's loading state (UI.md → States required on data
 * surfaces).
 *
 * A skeleton shaped like the form's sections, so the layout does not jump
 * when the employee's state is read.
 */
export default function ReviseSalaryLoading() {
  return (
    <>
      <PageHeader title="Loading the salary revision…" />
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-72 animate-pulse rounded-lg bg-muted" />
        <LoadingSkeleton rows={3} />
      </div>
    </>
  );
}
