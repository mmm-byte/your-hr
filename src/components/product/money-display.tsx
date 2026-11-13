import { formatMoney, type CurrencyCode, type MoneyString } from '@/lib/money';

/**
 * Money display (UI.md → Reusable product components, MON-003, RPT-005).
 *
 * The **only** place money is rendered. Every salary figure in the product goes
 * through this component, so a currency symbol can never be concatenated by
 * hand and a bare number can never be shown without its currency.
 *
 * Two distinct concepts that must stay visibly distinct:
 * - a local salary in the employee's own currency
 * - a USD equivalent derived through the fixed seed FX reference date (MON-005)
 *
 * The USD equivalent is rendered with its own label so it is never mistaken for
 * the employee's actual pay.
 */
export function MoneyDisplay({
  amount,
  currency,
  className,
  showCode = true,
}: {
  amount: MoneyString;
  currency: CurrencyCode;
  className?: string;
  showCode?: boolean;
}) {
  return (
    <span className={`tabular-nums ${className ?? ''}`}>
      {formatMoney(amount, currency, { includeCode: showCode })}
    </span>
  );
}

/**
 * The synthetic USD equivalent of a local salary.
 *
 * Labelled explicitly. MON-005 requires local currency and USD equivalent to be
 * distinguishable, and MON-006 requires the fixed FX reference date not to be
 * presented as a live market rate.
 * The amount is formatted **without** its currency code, because the label
 * beside it already names the currency: "$74,716.94 USD equivalent
 * (synthetic)". Appending the code as well would print "USD" twice, which
 * reads as a mistake rather than as emphasis.
 */
export function UsdEquivalentDisplay({
  amount,
  className,
}: {
  amount: MoneyString;
  className?: string;
}) {
  return (
    <span className={`tabular-nums text-muted-foreground ${className ?? ''}`}>
      {formatMoney(amount, 'USD', { includeCode: false })}{' '}
      <span className="text-xs">USD equivalent (synthetic)</span>
    </span>
  );
}

/**
 * A bonus percentage.
 *
 * Always shown next to its salary so it is never a number without context.
 */
export function BonusDisplay({
  bonusPct,
  className,
}: {
  bonusPct: string;
  className?: string;
}) {
  const value = Number(bonusPct);
  const formatted = Number.isFinite(value) ? value.toFixed(1) : bonusPct;

  return (
    <span className={`tabular-nums ${className ?? ''}`}>
      {formatted}% <span className="text-xs text-muted-foreground">bonus</span>
    </span>
  );
}
