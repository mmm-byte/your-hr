import type { ReactNode } from 'react';
import { MoneyDisplay } from './money-display';

/**
 * Aggregate displays (MON-004, MON-005, ANA-005, RPT-007).
 *
 * Every aggregate in this application is **grouped by currency**. The panel
 * is what makes that structural rather than a convention: a figure carries its
 * currency code, and a set of figures from different currencies is rendered
 * as separate blocks, never as one number.
 *
 * The rule this component exists to enforce:
 *
 * - **A total never spans currencies.** There is no code path here that
 *   receives two currencies and produces one amount (MON-004, RPT-007).
 * - **A USD-equivalent view is a separate, labelled mode.** When the panel
 *   shows the synthetic USD equivalent, it says so in the heading — the
 *   equivalent is never presented as the employee's actual pay (MON-005,
 *   MON-006).
 * - **The sample size is stated.** A median over three people and a median
 *   over three thousand are different facts (ANA-005).
 */

/** One currency's figures. */
export interface CurrencyFigure {
  readonly currency: string;
  /** The number of employees in this currency's population. */
  readonly headcount: number;
  readonly median: string | null;
  readonly average: string | null;
  readonly lowest: string | null;
  readonly highest: string | null;
}

/**
 * The figures for one currency.
 *
 * A `null` amount means "no data for this figure", which is a different fact
 * from zero (ANA-004). The panel renders it as an em dash and says why.
 */
function CurrencyBlock({ figure }: { figure: CurrencyFigure }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{figure.currency}</h3>
        <p className="text-xs text-muted-foreground">
          {figure.headcount} {figure.headcount === 1 ? 'employee' : 'employees'}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Figure label="Median" amount={figure.median} currency={figure.currency} />
        <Figure label="Average" amount={figure.average} currency={figure.currency} />
        <Figure label="Lowest" amount={figure.lowest} currency={figure.currency} />
        <Figure label="Highest" amount={figure.highest} currency={figure.currency} />
      </dl>
    </div>
  );
}

/**
 * One figure, with its label.
 *
 * The label comes before the amount so a screen reader reads "Median, $X
 * USD" rather than "$X USD, Median" — the label is what gives the number
 * its meaning.
 */
function Figure({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: string | null;
  currency: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">
        {amount === null ? (
          <span className="text-muted-foreground" title="No data for this figure">
            —
          </span>
        ) : (
          <MoneyDisplay amount={amount} currency={currency} />
        )}
      </dd>
    </div>
  );
}

/**
 * The aggregates for every currency, side by side.
 *
 * `usdEquivalent` is a **separate mode**: when it is true, the panel shows
 * the synthetic USD equivalent of each currency's population instead of the
 * local amounts. It is never mixed with the local figures in the same view —
 * a reader must never see a local amount and an equivalent side by side
 * without knowing which is which (MON-005).
 */
export function AggregatePanel({
  figures,
  heading,
  description,
  usdEquivalent = false,
}: {
  figures: readonly CurrencyFigure[];
  heading: string;
  description?: string;
  /**
   * Show the synthetic USD equivalent instead of the local amounts.
   *
   * The figures are still keyed by currency — the block heading says which
   * currency's population the equivalent describes.
   */
  usdEquivalent?: boolean;
}) {
  return (
    <section aria-label={heading} className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{heading}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {usdEquivalent ? (
        <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-foreground">
          These figures are the synthetic USD equivalent, converted at the fixed seed
          reference rate. They are not the local amounts these employees are paid, and
          the rate is not a live market rate.
        </p>
      ) : null}
      {figures.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-6 text-center text-sm text-muted-foreground">
          No figures to show for this selection.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {figures.map((figure) => (
            <CurrencyBlock key={figure.currency} figure={figure} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * A group of counts — headcount by country, by department, by level.
 *
 * The counts carry no money, so there is no currency question here. Each row
 * states its count next to the label, so the meaning does not depend on
 * reading the number alone (UI.md → Accessibility).
 */
export function CountGroupPanel({
  heading,
  groups,
  description,
  emptyMessage = 'No employees match this selection.',
  renderLabel,
}: {
  heading: string;
  groups: readonly { label: string; count: number }[];
  description?: string;
  emptyMessage?: string;
  /** Renders a group label — used to link to a filtered view. */
  renderLabel?: (group: { label: string; count: number }) => ReactNode;
}) {
  return (
    <section aria-label={heading} className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">{heading}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {groups.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li
              key={group.label}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate">
                {renderLabel ? renderLabel(group) : group.label}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {group.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
