/**
 * URL state helpers (RPT-003, QRY-006).
 *
 * Every filter, the search term, the sort, the page, and the reporting date
 * live in the query string. A shared link therefore reproduces exactly the
 * same view, and the browser's back and forward buttons walk through the
 * states the user has actually seen.
 *
 * These are **pure functions** over a plain record, not over Next's router, so
 * they can be tested without a router and reused by any surface that builds
 * a link.
 *
 * The one rule that is easy to get wrong is the page reset: applying, changing,
 * or clearing any filter must return to page 1, or the user lands on an empty
 * page and concludes the data is missing (QRY-006).
 */

import { isDateOnly } from './date-only';

/** The query-string keys the directory and analytics surfaces use. */
export type QueryState = Readonly<Record<string, string | undefined>>;

/**
 * Read the reporting date out of the query string.
 *
 * The reporting date is a **past or present** calendar day: the product asks
 * "what did this person earn as of this date", so the future is not a
 * meaningful answer, and the date picker does not offer it.
 *
 * A value that is not a real calendar day, or that lies in the future, falls
 * back to today rather than failing (QRY-003). Accepting a future date would
 * put the date control in a state the browser itself reports as invalid —
 * "Value must be 11/13/2026 or earlier" — with no explanation on the page.
 *
 * @param state the parsed query string
 * @param today the current calendar day, as `YYYY-MM-DD`
 */
export function readReportingDate(state: QueryState, today: string): string {
  const value = state.asOf;

  if (value === undefined || value === '') {
    return today;
  }

  if (!isDateOnly(value)) {
    return today;
  }

  return value > today ? today : value;
}

/**
 * Build a query string from a state record.
 *
 * Keys with an `undefined` or empty value are omitted, so a cleared filter
 * leaves no trace in the URL. The result is sorted by key, so the same state
 * always produces the same string — which keeps links stable and cacheable.
 */
export function buildQueryString(state: QueryState): string {
  const params = new URLSearchParams();

  for (const key of Object.keys(state).sort()) {
    const value = state[key];
    if (value !== undefined && value !== '') {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}

/**
 * Apply a change to the query state.
 *
 * `page` is reset to 1 whenever anything else changes, and is left alone when
 * only the page changes (QRY-006). A `null` value removes the key.
 */
export function applyQueryChange(
  state: QueryState,
  change: Readonly<Record<string, string | null | undefined>>,
  options: { resetPage?: boolean } = {},
): QueryState {
  const next: Record<string, string | undefined> = { ...state };
  let touchedSomethingOtherThanPage = false;

  for (const [key, value] of Object.entries(change)) {
    if (key === 'page') {
      // A page change is applied as given. It is the one change that must not
      // reset the page to 1 — resetting it would make the pager unusable.
      if (value === null || value === undefined) {
        delete next.page;
      } else {
        next.page = value;
      }
      continue;
    }
    touchedSomethingOtherThanPage = true;
    if (value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }

  if (options.resetPage ?? true) {
    if (touchedSomethingOtherThanPage) {
      next.page = '1';
    }
  }

  return next;
}

/**
 * The state with every filter cleared, keeping the reporting date.
 *
 * The reporting date is not a filter — it changes what "current" means
 * rather than which rows are shown — so it survives a "clear filters" action.
 */
export function clearFilters(state: QueryState): QueryState {
  const next: Record<string, string | undefined> = {};

  if (state.asOf !== undefined && state.asOf !== '') {
    next.asOf = state.asOf;
  }
  if (state.sort !== undefined && state.sort !== '') {
    next.sort = state.sort;
  }

  return next;
}

/**
 * Read a query-string record into a plain state object.
 *
 * The first value of a repeated parameter is used, matching the behaviour of
 * the boundary schema.
 */
export function readQueryState(
  params: URLSearchParams | Readonly<Record<string, string | string[] | undefined>>,
): QueryState {
  if (params instanceof URLSearchParams) {
    const state: Record<string, string | undefined> = {};
    for (const key of new Set(params.keys())) {
      state[key] = params.get(key) ?? undefined;
    }
    return state;
  }

  const state: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    state[key] = Array.isArray(value) ? value[0] : value;
  }
  return state;
}

/**
 * True when at least one filter is narrowing the results.
 *
 * The list of filter keys is named explicitly rather than derived from the
 * state, because `sort` and `asOf` are not filters — `sort` changes the
 * order, and `asOf` changes what "current" means — and neither narrows the
 * row set.
 */
const FILTER_KEYS = [
  'search',
  'country',
  'branch',
  'department',
  'level',
  'status',
  'workMode',
] as const;

export function hasActiveFilter(state: QueryState): boolean {
  return FILTER_KEYS.some((key) => {
    const value = state[key];
    return value !== undefined && value !== '';
  });
}
