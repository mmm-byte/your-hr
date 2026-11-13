'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Route } from 'next';
import { Search, X } from 'lucide-react';
import {
  BRANCH_CODES,
  COUNTRY_CODES,
  DEPARTMENT_NAMES,
  EMPLOYMENT_STATUSES,
  JOB_LEVELS,
  WORK_MODES,
} from '@/lib/domain-values';
import {
  applyQueryChange,
  buildQueryString,
  hasActiveFilter,
  readQueryState,
} from '@/lib/url-state';

/**
 * The directory filter bar (QRY-001…QRY-006, UX-JOURNEY §3).
 *
 * Every control writes to the **URL**, and the URL is the only state. There is
 * no client-side copy of the filter state to fall out of step with the
 * server's, so a refresh, a shared link, and the back button all reproduce the
 * same view (RPT-003).
 *
 * The controls are plain GET form fields that submit on change. A form is
 * used rather than a set of `onChange` handlers because it works without
 * JavaScript, it is keyboard-accessible for free, and the browser's own
 * semantics for a search field are the ones a user expects.
 *
 * **Search is submitted, not fired on every keystroke** (UX-JOURNEY §3): the
 * term is held locally and submitted on Enter or on the search button.
 */
export function FilterBar({
  /** The branch codes that belong to each country, for the dependent filter. */
  branchesByCountry,
}: {
  branchesByCountry: Readonly<Record<string, readonly string[]>>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const state = readQueryState(searchParams);
  const [search, setSearch] = useState(state.search ?? '');
  const [searchInUrl, setSearchInUrl] = useState(state.search);

  // Keep the field in step when the URL changes — the user may use the back
  // button, and the field must show the term now in effect.
  //
  // The state is adjusted during render rather than in an effect: React
  // re-renders immediately without the extra cascading render an effect
  // would cause.
  if (state.search !== searchInUrl) {
    setSearchInUrl(state.search);
    setSearch(state.search ?? '');
  }

  function navigate(next: Record<string, string | null | undefined>): void {
    const updated = applyQueryChange(state, next);
    const query = buildQueryString(updated);
    startTransition(() => {
      router.replace((query === '' ? '/employees' : `/employees${query}`) as Route, {
        scroll: false,
      });
    });
  }

  const selectedCountry = state.country;
  const branchOptions = selectedCountry
    ? (branchesByCountry[selectedCountry] ?? [])
    : BRANCH_CODES;

  return (
    <form
      role="search"
      aria-label="Filter the employee directory"
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = search.trim();
        navigate({ search: trimmed === '' ? null : trimmed });
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="directory-search" className="block text-sm font-medium">
            Search
          </label>
          <div className="mt-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="directory-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Employee ID, name, or email"
                aria-describedby="directory-search-help"
                className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
            </div>
            <button
              type="submit"
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Search
            </button>
          </div>
          <p id="directory-search-help" className="mt-1 text-xs text-muted-foreground">
            Matches the employee ID, full name, or email.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <FilterSelect
          id="filter-country"
          label="Country"
          value={state.country}
          options={COUNTRY_CODES.map((code) => ({ value: code, label: code }))}
          onChange={(value) => {
            // The branch filter is dependent: choosing a country narrows the
            // branch options, and resets the branch if it no longer applies.
            const stillApplies =
              value === undefined ||
              (branchOptions as readonly string[]).includes(state.branch ?? '');
            navigate({
              country: value ?? null,
              branch: stillApplies ? undefined : null,
            });
          }}
        />

        <FilterSelect
          id="filter-branch"
          label="Branch"
          value={state.branch}
          options={branchOptions.map((code) => ({ value: code, label: code }))}
          onChange={(value) => navigate({ branch: value ?? null })}
        />

        <FilterSelect
          id="filter-department"
          label="Department"
          value={state.department}
          options={DEPARTMENT_NAMES.map((name) => ({ value: name, label: name }))}
          onChange={(value) => navigate({ department: value ?? null })}
        />

        <FilterSelect
          id="filter-level"
          label="Job level"
          value={state.level}
          options={JOB_LEVELS.map((level) => ({ value: String(level), label: `Level ${level}` }))}
          onChange={(value) => navigate({ level: value ?? null })}
        />

        <FilterSelect
          id="filter-status"
          label="Status"
          value={state.status}
          options={EMPLOYMENT_STATUSES.map((status) => ({
            value: status,
            label: status === 'on_leave' ? 'On leave' : status,
          }))}
          onChange={(value) => navigate({ status: value ?? null })}
        />

        <FilterSelect
          id="filter-work-mode"
          label="Work mode"
          value={state.workMode}
          options={WORK_MODES.map((mode) => ({
            value: mode,
            label: mode === 'remote' ? 'Remote' : mode === 'office' ? 'On site' : 'Hybrid',
          }))}
          onChange={(value) => navigate({ workMode: value ?? null })}
        />
      </div>

      {hasActiveFilter(state) ? (
        <button
          type="button"
          onClick={() => {
            setSearch('');
            navigate({
              search: null,
              country: null,
              branch: null,
              department: null,
              level: null,
              status: null,
              workMode: null,
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X aria-hidden="true" className="size-4" />
          Clear filters
        </button>
      ) : null}
    </form>
  );
}

/**
 * A labelled filter dropdown.
 *
 * The first option is the "no filter" option, so a filter can always be
 * cleared from the control itself without a separate control.
 */
function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
