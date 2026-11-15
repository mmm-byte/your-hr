import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Route } from 'next';
import { Suspense } from 'react';
import { ArrowLeft, CalendarDays, Gavel, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { getDatabase } from '@/db/client';
import { queryEmployeeProfile } from '@/db/queries/current-salary';
import { formatDateLong, todayDateOnly } from '@/lib/date-only';
import { readQueryState, readReportingDate } from '@/lib/url-state';
import { salaryCardAsOf, salaryCardLabel } from '@/lib/employment';
import { isEligibleForRevision } from '@/lib/salary-rules';
import { CountryBranchLabel, DateFact, EmployeeIdentity, Fact, JobTitleLabel, WorkModeLabel } from '@/components/product/employee-identity';
import { PageHeader } from '@/components/product/page-header';
import { ReportingDatePicker } from '@/components/product/reporting-date-picker';
import { SalaryCard, SalaryHistoryEntry } from '@/components/product/salary-card';
import { EmploymentStatusBadge } from '@/components/product/status-badge';
import { EmptyState } from '@/components/product/empty-state';

export const metadata: Metadata = {
  title: 'Employee',
};

/**
 * The employee profile (UX-JOURNEY.md §4).
 *
 * A **server component**: the reporting date is read from the URL, so the
 * profile shows the same compensation as the directory the user came from
 * (RPT-003).
 *
 * Every section states what it is. The absence and performance context are
 * the seed's **summaries**, not dated history, and are labelled as such
 * (SEED-001, SEED-002, D-018).
 */
export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employeeId } = await params;
  const raw = await searchParams;
  const state = readQueryState(raw);

  const id = Number(employeeId);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const reportingDate = readReportingDate(state, todayDateOnly());
  const db = getDatabase();
  const profile = await queryEmployeeProfile(db, id, reportingDate);

  // An unknown employee is a **controlled not-found**, never a raw 500
  // (UX-JOURNEY §4.2).
  if (profile === null) {
    notFound();
  }

  const { employee } = profile;

  return (
    <>
      <Link
        href="/employees"
        className="mb-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to employees
      </Link>

      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        context={`As of ${formatDateLong(reportingDate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* ELG-005: the revision surface is **absent** for an employee
                who is not eligible, not merely disabled with a reason. A
                terminated employee's history is closed. */}
            {isEligibleForRevision(employee.employmentStatus) ? (
              <Link
                href={`/employees/${employee.id}/revise-salary` as Route}
                className="inline-flex rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Revise salary
              </Link>
            ) : null}
            <Suspense fallback={null}>
              <ReportingDatePicker value={reportingDate} max={todayDateOnly()} />
            </Suspense>
          </div>
        }
      />

      <div className="space-y-6">
        <section
          aria-label="Identity and employment"
          className="rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <EmployeeIdentity
              firstName={employee.firstName}
              lastName={employee.lastName}
              employeeId={employee.id}
              className="text-lg font-semibold"
              showEmail
              email={employee.email}
            />
            <EmploymentStatusBadge status={employee.employmentStatus} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Fact label="Job title">
              <JobTitleLabel jobTitle={employee.jobTitle} jobLevel={employee.jobLevel} />
            </Fact>
            <Fact label="Department">{employee.departmentName}</Fact>
            <Fact label="Location">
              <CountryBranchLabel
                countryCode={employee.countryCode}
                branchCode={employee.branchCode}
                branchCity={employee.branchCity}
              />
            </Fact>
            <Fact label="Work mode">
              <WorkModeLabel workMode={employee.workMode} />
            </Fact>
            <Fact label="Hired">
              <DateFact date={employee.hireDate} />
            </Fact>
            {employee.terminationDate !== null ? (
              <Fact label="Termination">
                <DateFact date={employee.terminationDate} />
              </Fact>
            ) : null}
            <Fact label="Country">{employee.countryCode}</Fact>
            <Fact label="Local currency">{employee.branchCurrencyCode}</Fact>
          </dl>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label="Compensation">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <TrendingUp aria-hidden="true" className="size-4 text-muted-foreground" />
              Compensation
            </h2>

            {profile.currentSalary !== null ? (
              <SalaryCard
                baseSalary={profile.currentSalary.baseSalary}
                bonusPct={profile.currentSalary.bonusPct}
                currencyCode={profile.currentSalary.currencyCode}
                effectiveFrom={profile.currentSalary.effectiveFrom}
                usdEquivalent={profile.currentSalary.usdEquivalent}
                reportingDate={reportingDate}
                label={salaryCardLabel({
                  hireDate: employee.hireDate,
                  terminationDate: employee.terminationDate,
                  employmentStatus: employee.employmentStatus,
                })}
                asOf={salaryCardAsOf(
                  {
                    hireDate: employee.hireDate,
                    terminationDate: employee.terminationDate,
                    employmentStatus: employee.employmentStatus,
                  },
                  reportingDate,
                )}
                scheduled={
                  profile.scheduledSalary !== null
                    ? {
                        baseSalary: profile.scheduledSalary.baseSalary,
                        currencyCode: profile.scheduledSalary.currencyCode,
                        effectiveFrom: profile.scheduledSalary.effectiveFrom,
                      }
                    : null
                }
              />
            ) : (
              <EmptyState
                title="No salary record"
                description={`No salary record is effective on or before ${formatDateLong(reportingDate)}.`}
              />
            )}
          </section>

          <section aria-label="Supporting context">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
              Supporting context
            </h2>

            <div className="space-y-3">
              <SummaryCard
                icon={<CalendarDays aria-hidden="true" className="size-4" />}
                title="Absence"
                value={
                  profile.absence !== null
                    ? `${profile.absence.totalDays} days across ${profile.absence.recordCount} records`
                    : 'No absence records'
                }
                note="Seed summary — not dated leave history"
              />

              <SummaryCard
                icon={<TrendingUp aria-hidden="true" className="size-4" />}
                title="Latest performance review"
                value={
                  profile.performance !== null
                    ? `${profile.performance.rating}/5 on ${formatDateLong(profile.performance.reviewDate)}, goals met ${profile.performance.goalsMetPct}%`
                    : 'No performance review'
                }
                note="Seed summary — the latest review only"
              />

              {profile.attrition !== null ? (
                <SummaryCard
                  icon={<Gavel aria-hidden="true" className="size-4" />}
                  title="Employment history"
                  value={`Left on ${formatDateLong(profile.attrition.leftOn)} — ${profile.attrition.reason.replace(/_/g, ' ')}`}
                  note="Seed attrition event"
                />
              ) : null}
            </div>
          </section>
        </div>

        <section aria-label="Salary history">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <TrendingUp aria-hidden="true" className="size-4 text-muted-foreground" />
            Salary history
          </h2>

          {profile.salaryHistory.length > 0 ? (
            <ol className="space-y-4">
              {profile.salaryHistory.map((record) => (
                <SalaryHistoryEntry
                  key={record.id}
                  effectiveFrom={record.effectiveFrom}
                  baseSalary={record.baseSalary}
                  bonusPct={record.bonusPct}
                  currencyCode={record.currencyCode}
                  usdEquivalent={record.usdEquivalent}
                  changeReason={record.changeReason}
                  recordedAt={record.createdAt}
                  isCurrent={profile.currentSalary?.id === record.id}
                  isScheduled={profile.scheduledSalary?.id === record.id}
                />
              ))}
            </ol>
          ) : (
            <EmptyState
              title="No salary history"
              description="This employee has no salary records yet."
            />
          )}
        </section>
      </div>
    </>
  );
}

/**
 * A labelled summary with its provenance note.
 *
 * The note is not decoration: it is what stops a reader mistaking a seed
 * summary for dated event history (D-018).
 */
function SummaryCard({
  icon,
  title,
  value,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span aria-hidden="true">{icon}</span>
        {title}
      </p>
      <p className="mt-1 text-sm">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
