import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { formatCount } from '@/lib/money';

/**
 * The employee directory table (UI.md → Table UX, UX-JOURNEY §3).
 *
 * A server-rendered table. The rows come from the database already
 * paginated and sorted, so the browser never holds the 10,000-person
 * workforce (ANA-007).
 *
 * **Sorting is by link, not by script.** A column header is an anchor to the
 * same page with a different `sort` in the query string, so sorting works
 * without JavaScript, is keyboard-accessible, and produces a shareable URL
 * (RPT-003). The current sort is announced with `aria-sort`, which is what a
 * screen reader reads out.
 *
 * The column order follows the directory contract: Employee, Status, Job title
 * + level, Country / Branch, Current salary, Work mode.
 */
export interface Column<T> {
  readonly key: string;
  readonly header: string;
  /** The `sort` value for this column, when the column is sortable. */
  readonly sortValue?: string;
  readonly render: (row: T) => ReactNode;
  /** Hidden below the `sm` breakpoint to keep the narrow layout readable. */
  readonly secondary?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  caption,
  sort,
  sortHref,
  emptyState,
}: {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string | number;
  /** Builds the profile link for a row. */
  rowHref: (row: T) => Route;
  /** The table's accessible caption. */
  caption: string;
  /** The sort currently in effect. */
  sort: string;
  /** Builds the link for a sortable column header. */
  sortHref: (sortValue: string) => Route;
  /** Rendered when there are no rows. */
  emptyState: ReactNode;
}) {
  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={ariaSortFor(column.sortValue, sort)}
                className={`px-3 py-2 text-left font-medium ${
                  column.secondary ? 'hidden md:table-cell' : ''
                }`}
              >
                {column.sortValue ? (
                  <Link
                    href={sortHref(column.sortValue)}
                    className="inline-flex items-center gap-1 rounded hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {column.header}
                    <SortIndicator active={column.sortValue === sort} />
                  </Link>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-border last:border-0 hover:bg-surface-subtle"
            >
              {columns.map((column, index) => (
                <td
                  key={column.key}
                  className={`px-3 py-2 align-top ${
                    column.secondary ? 'hidden md:table-cell' : ''
                  }`}
                >
                  {index === 0 ? (
                    <Link
                      href={rowHref(row)}
                      className="rounded hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {column.render(row)}
                    </Link>
                  ) : (
                    column.render(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The `aria-sort` value for a column.
 *
 * Only the column that is currently sorted carries the attribute; the others
 * are explicitly `none`, so a screen reader can state the current order rather
 * than leaving it ambiguous.
 */
function ariaSortFor(columnSort: string | undefined, currentSort: string): 'ascending' | 'descending' | 'none' {
  if (columnSort === undefined || columnSort !== currentSort) {
    return 'none';
  }
  // The salary column sorts descending by default — the highest salary first.
  return columnSort === 'salary' ? 'descending' : 'ascending';
}

/**
 * The sort indicator.
 *
 * The arrow is paired with the `aria-sort` attribute on the header, so the
 * state is not conveyed by the icon alone.
 */
function SortIndicator({ active }: { active: boolean }) {
  if (!active) {
    return <span aria-hidden="true" className="size-3.5 text-muted-foreground/40" />;
  }
  return (
    <span aria-hidden="true" className="inline-flex">
      <ArrowUp className="size-3.5" />
      <ArrowDown className="size-3.5 -ml-2" />
    </span>
  );
}

/**
 * The server-side pager (QRY-004).
 *
 * A page beyond the last page is not an error — the table shows no rows and
 * the pager still shows the real total, so the reader can tell "you are past
 * the end" from "there is no data".
 */
export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Builds the link for a page number. */
  hrefFor: (page: number) => Route;
}) {
  if (total === 0) {
    return null;
  }

  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const canGoBack = page > 1;
  const canGoForward = page < totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row"
    >
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{formatCount(firstRow)}</span>–
        <span className="font-medium text-foreground">{formatCount(lastRow)}</span> of{' '}
        <span className="font-medium text-foreground">{formatCount(total)}</span> matching
        employees
      </p>

      <div className="flex items-center gap-2">
        <PagerLink href={hrefFor(page - 1)} disabled={!canGoBack} label="Previous page">
          <ChevronLeft aria-hidden="true" className="size-4" />
        </PagerLink>

        <span className="text-sm text-muted-foreground">
          Page <span className="font-medium text-foreground">{page}</span> of{' '}
          <span className="font-medium text-foreground">{Math.max(totalPages, 1)}</span>
        </span>

        <PagerLink href={hrefFor(page + 1)} disabled={!canGoForward} label="Next page">
          <ChevronRight aria-hidden="true" className="size-4" />
        </PagerLink>
      </div>
    </nav>
  );
}

/**
 * A pager link.
 *
 * A disabled link renders as a `<span>` rather than an anchor with
 * `aria-disabled`, so it is not focusable and a screen reader does not
 * announce a link that goes nowhere.
 */
function PagerLink({
  href,
  disabled,
  label,
  children,
}: {
  href: Route;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  const className =
    'inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

  if (disabled) {
    return (
      <span aria-disabled="true" className={`${className} text-muted-foreground opacity-50`}>
        {children}
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  );
}
