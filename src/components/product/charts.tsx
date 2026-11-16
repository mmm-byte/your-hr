'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * The bar chart (UI.md → Charts, D-036).
 *
 * A chart is a **second way to read the figures**, never the only way. Every
 * chart here is rendered beside a table carrying the same numbers and beside
 * a text summary, because a chart encodes its data in position and hue —
 * channels a screen reader cannot read and a colour-vision difference cannot
 * decode (D-036).
 *
 * The chart is deliberately plain:
 *
 * - **One colour for every bar.** The bars carry no meaning beyond their
 *   length, so a second colour would encode nothing. When a chart *does* need
 *   to distinguish categories, the distinction is in the table, not the hue.
 * - **The axis is labelled and the bars are named.** An unlabelled axis is a
 *   number with no unit.
 * - **`role="img"` with a label.** The chart is an image to assistive
 *   technology; the label says what it shows, and the table beside it carries
 *   the precise numbers.
 *
 * The component is a client component because Recharts measures the DOM.
 */

/** One bar. */
export interface BarDatum {
  readonly label: string;
  readonly value: number;
}

export function HeadcountBarChart({
  data,
  title,
  valueLabel = 'employees',
}: {
  data: readonly BarDatum[];
  /** The accessible name of the chart. */
  title: string;
  /** What one unit means, used in the axis and the label. */
  valueLabel?: string;
}) {
  if (data.length === 0) {
    return null;
  }

  return (
    <figure className="space-y-2">
      <div
        role="img"
        aria-label={chartLabel(title, data, valueLabel)}
        className="h-64 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data as BarDatum[]} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={70}
            />
            <YAxis tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'var(--color-surface-subtle)' }}
              formatter={(value) => [`${String(value)} ${valueLabel}`, 'Headcount']}
            />
            <Bar dataKey="value" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        The same figures are in the table below.
      </figcaption>
    </figure>
  );
}

/**
 * The chart's accessible name.
 *
 * It states what the chart shows and its range, so a screen-reader user knows
 * what they are about to encounter without having to read every bar.
 */
function chartLabel(
  title: string,
  data: readonly BarDatum[],
  valueLabel: string,
): string {
  const highest = data.reduce((max, item) => (item.value > max.value ? item : max), data[0] as BarDatum);
  return `${title}. ${data.length} categories. The largest is ${highest.label} with ${highest.value} ${valueLabel}.`;
}
