'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { applyQueryChange, buildQueryString, readQueryState } from '@/lib/url-state';

/**
 * The rows-per-page selector.
 *
 * A small client component, because choosing a size is an interaction. It
 * **navigates** rather than holding the size in state, so the size lives in
 * the URL like the rest of the directory's state and a shared link reproduces
 * the same view (RPT-003, D-029).
 *
 * The page always resets to 1 when the size changes: a page number is only
 * meaningful relative to the page size that produced it (QRY-006).
 *
 * The component reads the current query string itself rather than receiving
 * a callback, because a function cannot be passed from a server component to
 * a client component.
 */
export function PageSizeSelect({
  pageSize,
  options,
  basePath = '/employees',
}: {
  /** The size currently in effect. */
  pageSize: number;
  /** The sizes offered. */
  options: readonly number[];
  /** The route the size applies to. */
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function choose(size: number): void {
    const state = readQueryState(searchParams);
    const query = buildQueryString(applyQueryChange(state, { pageSize: String(size) }));
    // `replace`, not `push`: changing a filter rewrites the current view
    // rather than adding a history entry, so the back button returns to the
    // previous page rather than through every filter the reader tried.
    router.replace(`${basePath}${query}` as Route, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="page-size" className="text-sm text-muted-foreground">
        Rows per page
      </label>
      <select
        id="page-size"
        value={pageSize}
        onChange={(event) => {
          choose(Number(event.target.value));
        }}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {options.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
}
