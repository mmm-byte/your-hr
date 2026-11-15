import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { getDatabase } from '@/db/client';
import { readRevisionContext, type RevisionDatabase } from '@/db/queries/salary-revision';
import { SalaryRevisionForm } from '@/components/product/salary-revision-form';
import { EmployeeIdentity } from '@/components/product/employee-identity';
import { EmploymentStatusBadge } from '@/components/product/status-badge';
import { EmptyState } from '@/components/product/empty-state';
import { PageHeader } from '@/components/product/page-header';
import { isEligibleForRevision } from '@/lib/salary-rules';
import { formatDateLong, todayDateOnly } from '@/lib/date-only';

export const metadata: Metadata = {
  title: 'Revise salary',
};

/**
 * The salary revision page (UX-JOURNEY §3 Step 6, ELG-001…ELG-005,
 * CON-001, SAL-009).
 *
 * A **server component**: it reads the employee's state and renders the
 * form with the version the reader was shown, so the submission can be
 * checked for staleness (CON-001).
 *
 * The page is a **dedicated page, not a modal**, so the context is
 * preserved and the form is keyboard-accessible (UX-JOURNEY §3 Step 6).
 *
 * Two outcomes are controlled rather than errors:
 *
 * - An unknown employee is a scoped not-found (UX-JOURNEY §4.2).
 * - An employee who is not eligible gets **no form at all**. The revision
 *   surface must be unavailable, not merely disabled with a reason
 *   (ELG-005), so the page states that the history is closed and links
 *   back to the profile.
 */
export default async function ReviseSalaryPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId: rawId } = await params;
  const employeeId = Number(rawId);

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    notFound();
  }

  const db = getDatabase() as unknown as RevisionDatabase;
  const context = await readRevisionContext(db, employeeId);

  if (context === null) {
    notFound();
  }

  // `notFound()` throws, so the context is known here; the binding is
  // narrowed explicitly because the compiler cannot see through it.
  const employee = context;

  // The eligibility gate. A terminated employee's salary history is closed
  // (ELG-001), and the revision surface is absent rather than disabled
  // (ELG-005).
  if (!isEligibleForRevision(employee.employee.employmentStatus)) {
    return (
      <>
        <Link
          href={`/employees/${employeeId}`}
          className="mb-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to employee
        </Link>
        <PageHeader title="This salary cannot be revised" />
        <EmptyState
          icon={<ShieldAlert aria-hidden="true" className="size-5" />}
          title="This employee's salary history is closed"
          description="A salary revision can only be created for an employee who is still employed. This employee's history stays fully readable, including the salary they were on when they left."
          action={
            <Link
              href={`/employees/${employeeId}`}
              className="inline-flex rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Open the profile
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <Link
        href={`/employees/${employeeId}`}
        className="mb-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to employee
      </Link>

      <PageHeader
        title="Revise salary"
        description="Add a new effective-dated salary record. The existing history is never rewritten."
        context={`As of ${formatDateLong(todayDateOnly())}`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <EmployeeIdentity
          firstName=""
          lastName=""
          employeeId={employeeId}
        />
        <EmploymentStatusBadge status={employee.employee.employmentStatus} />
      </div>

      <SalaryRevisionForm
        context={{
          employeeId: employee.employee.id,
          employeeName: `Employee #${employee.employee.id}`,
          currency: employee.employee.currency,
          hireDate: employee.employee.hireDate,
          terminationDate: employee.employee.terminationDate,
          version: employee.employee.version,
          currentSalary:
            employee.currentSalary === null
              ? null
              : {
                  baseSalary: employee.currentSalary.baseSalary,
                  bonusPct: employee.currentSalary.bonusPct,
                  effectiveFrom: employee.currentSalary.effectiveFrom,
                },
          existingEffectiveDates: employee.existingEffectiveDates,
        }}
      />
    </>
  );
}
