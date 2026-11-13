import { formatDateLong } from '@/lib/date-only';

/**
 * Employee identity and location (UI.md → Reusable product components).
 *
 * The identity block is the anchor of every surface that shows a person: the
 * directory row, the profile header, and the revision form. It always shows
 * the **employee ID** alongside the name, because a name is not a stable
 * identifier and a reviewer comparing the directory against the seed needs
 * the ID (EMP-001).
 *
 * The location block names the country and the branch, because a branch is
 * always inside a country and the country is what determines the local
 * currency (EMP-007).
 *
 * No database access: these components receive the values they render.
 */

/** A person's name and employee ID. */
export function EmployeeIdentity({
  firstName,
  lastName,
  employeeId,
  className,
  showEmail = false,
  email,
}: {
  firstName: string;
  lastName: string;
  employeeId: number;
  className?: string;
  showEmail?: boolean;
  email?: string;
}) {
  return (
    <span className={className}>
      <span className="font-medium">
        {firstName} {lastName}
      </span>{' '}
      <span className="text-xs text-muted-foreground">#{employeeId}</span>
      {showEmail && email ? (
        <span className="block text-xs text-muted-foreground">{email}</span>
      ) : null}
    </span>
  );
}

/**
 * The country and branch.
 *
 * The branch code is shown next to the city so the value matches the seeded
 * `branch_code` exactly — a reviewer can then find the same branch in the
 * dataset.
 */
export function CountryBranchLabel({
  countryCode,
  branchCode,
  branchCity,
  className,
}: {
  countryCode: string;
  branchCode: string;
  branchCity: string;
  className?: string;
}) {
  return (
    <span className={className}>
      <span className="font-medium">{countryCode}</span>
      <span className="text-muted-foreground"> · {branchCode}</span>
      <span className="block text-xs text-muted-foreground">{branchCity}</span>
    </span>
  );
}

/**
 * A labelled fact, used for the profile's identity grid.
 *
 * The label is a `<dt>` and the value a `<dd>`, so the pair is announced
 * together by a screen reader instead of the value floating on its own.
 */
export function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

/**
 * A job title with its level.
 *
 * The level is shown as `Level N` rather than a bare number, because a bare
 * integer in a list of job titles means nothing on its own.
 */
export function JobTitleLabel({
  jobTitle,
  jobLevel,
  className,
}: {
  jobTitle: string;
  jobLevel: number;
  className?: string;
}) {
  return (
    <span className={className}>
      {jobTitle}
      <span className="block text-xs text-muted-foreground">Level {jobLevel}</span>
    </span>
  );
}

/**
 * A work mode, written out in full.
 *
 * The seeded value is `remote`, `hybrid`, or `office`; the label reads
 * "Remote work" rather than the raw value so it is understandable at a
 * glance without a legend.
 */
export function WorkModeLabel({
  workMode,
  className,
}: {
  workMode: string;
  className?: string;
}) {
  const label: Record<string, string> = {
    remote: 'Remote work',
    hybrid: 'Hybrid',
    office: 'On site',
  };

  return <span className={className}>{label[workMode] ?? workMode}</span>;
}

/**
 * A hire or termination date.
 *
 * The date is formatted from its parts with an explicit UTC timezone, so the
 * rendered day is always the stored day (RPT-004). `2026-03-01` must never
 * display as 28 February.
 *
 * The value carries no label of its own: it sits inside a `Fact`, whose term
 * is already the label. Repeating it would read as "Hired: Hired: 26 Feb
 * 2026".
 */
export function DateFact({
  date,
  className,
}: {
  date: string;
  className?: string;
}) {
  return <span className={className}>{formatDateLong(date)}</span>;
}
