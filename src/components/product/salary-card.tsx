import { CalendarClock } from 'lucide-react';
import { BonusDisplay, MoneyDisplay, UsdEquivalentDisplay } from './money-display';
import { StatusBadge } from './status-badge';
import { formatDateLong } from '@/lib/date-only';

/**
 * The compensation card (UI.md → Employee page, RPT-002, SAL-008, ELG-006).
 *
 * Three rules shape this component:
 *
 * - **The reporting date is stated in words.** A reader must always know
 *   which date "current" refers to (RPT-002).
 * - **A scheduled revision is shown separately and labelled.** A
 *   future-effective record is visible — hiding it would be dishonest — but
 *   it is never presented as current compensation (SAL-008).
 * - **A terminated employee's salary is labelled as of termination**, never as
 *   the current salary (ELG-006).
 */
export function SalaryCard({
  baseSalary,
  bonusPct,
  currencyCode,
  effectiveFrom,
  usdEquivalent,
  reportingDate,
  label = 'Current salary',
  scheduled,
}: {
  baseSalary: string;
  bonusPct: string;
  currencyCode: string;
  effectiveFrom: string;
  usdEquivalent: string | null;
  reportingDate: string;
  /** The heading, which differs for a terminated employee. */
  label?: string;
  /** The next scheduled change, shown separately when one exists. */
  scheduled?: { baseSalary: string; currencyCode: string; effectiveFrom: string } | null;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label={label}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{label}</h2>
        <p className="text-xs text-muted-foreground">
          Current as of <span className="font-medium text-foreground">{formatDateLong(reportingDate)}</span>
        </p>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight">
        <MoneyDisplay amount={baseSalary} currency={currencyCode} />
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Bonus</dt>
          <dd>
            <BonusDisplay bonusPct={bonusPct} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Effective from</dt>
          <dd>{formatDateLong(effectiveFrom)}</dd>
        </div>
      </dl>

      {usdEquivalent !== null ? (
        <p className="mt-3 border-t border-border pt-3 text-sm">
          <UsdEquivalentDisplay amount={usdEquivalent} />
        </p>
      ) : null}

      {scheduled ? (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning-subtle p-3">
          <div className="flex items-center gap-1.5">
            <CalendarClock aria-hidden="true" className="size-4 text-warning-foreground" />
            <p className="text-sm font-medium">Scheduled</p>
          </div>
          <p className="mt-1 text-sm">
            Effective {formatDateLong(scheduled.effectiveFrom)}:{' '}
            <MoneyDisplay amount={scheduled.baseSalary} currency={scheduled.currencyCode} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Not counted as current compensation.
          </p>
        </div>
      ) : null}
    </section>
  );
}

/**
 * A salary history timeline entry.
 *
 * Each entry states its own effective date, amount, and currency, so a reader
 * can follow the history without exporting it (UX-JOURNEY §5).
 */
export function SalaryHistoryEntry({
  effectiveFrom,
  baseSalary,
  bonusPct,
  currencyCode,
  usdEquivalent,
  changeReason,
  isCurrent,
  isScheduled,
}: {
  effectiveFrom: string;
  baseSalary: string;
  bonusPct: string;
  currencyCode: string;
  usdEquivalent: string | null;
  changeReason: string | null;
  isCurrent: boolean;
  isScheduled: boolean;
}) {
  return (
    <li className="border-l-2 border-border pl-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{formatDateLong(effectiveFrom)}</p>
        {isCurrent ? <StatusBadge tone="positive" prefix="●">Current</StatusBadge> : null}
        {isScheduled ? <StatusBadge tone="caution" prefix="◐">Scheduled</StatusBadge> : null}
      </div>

      <p className="mt-1 text-sm">
        <MoneyDisplay amount={baseSalary} currency={currencyCode} />
        <span className="ml-2">
          <BonusDisplay bonusPct={bonusPct} />
        </span>
      </p>

      {usdEquivalent !== null ? (
        <p className="mt-0.5 text-xs">
          <UsdEquivalentDisplay amount={usdEquivalent} />
        </p>
      ) : null}

      {changeReason !== null ? (
        <p className="mt-1 text-xs text-muted-foreground">Reason: {changeReason}</p>
      ) : null}
    </li>
  );
}
