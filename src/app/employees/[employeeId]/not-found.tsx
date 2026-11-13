import Link from 'next/link';
import { UserX } from 'lucide-react';
import { EmptyState } from '@/components/product/empty-state';

/**
 * The employee-scoped not-found state (UX-JOURNEY §4.2).
 *
 * An unknown employee ID is a **controlled** outcome, never a raw 500. The
 * message names the recovery route — the directory — rather than leaving the
 * reader on a dead page.
 */
export default function EmployeeNotFound() {
  return (
    <EmptyState
      icon={<UserX aria-hidden="true" className="size-5" />}
      title="That employee could not be found"
      description="The employee ID does not match anyone in the workforce. Search the directory by name, ID, or email to find the person you are looking for."
      action={
        <Link
          href="/employees"
          className="inline-flex rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Back to employees
        </Link>
      }
    />
  );
}
