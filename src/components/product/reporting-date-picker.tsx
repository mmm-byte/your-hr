'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CalendarDays } from 'lucide-react';
import { isDateOnly } from '@/lib/date-only';

/**
 * The reporting date control (RPT-001, RPT-002, RPT-003).
 *
 * Every money surface shares this one control, so the reporting date can
 * never differ between two panels of the same screen.
 *
 * The date lives in the URL as `?asOf=YYYY-MM-DD` (RPT-003), which means a
 * shared link reproduces exactly the same view, and the browser's back and
 * forward buttons walk through the reporting dates the user has looked at.
 *
 * The control is a **client** component because it navigates. The date it
 * starts from is read from the URL, so the server and the browser agree on
 * the first render and there is no hydration mismatch.
 */
export function ReportingDatePicker({
  /** The reporting date currently in effect, as `YYYY-MM-DD`. */
  value,
  /** The maximum selectable date — today, so the future is not offered. */
  max,
}: {
  value: string;
  max: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(value);
  const [valueInUrl, setValueInUrl] = useState(value);

  // Keep the draft in step when the URL changes — the user may use the
  // browser's back button, and the field must show the date now in effect.
  //
  // The state is adjusted during render rather than in an effect: React
  // re-renders immediately without the extra cascading render an effect
  // would cause.
  if (value !== valueInUrl) {
    setValueInUrl(value);
    setDraft(value);
  }

  function apply(next: string): void {
    if (!isDateOnly(next)) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('asOf', next);
    // Changing the reporting date re-reads every panel on the page, so the
    // page is re-rendered rather than patched.
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="reporting-date"
        className="flex items-center gap-1.5 text-sm font-medium"
      >
        <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
        Reporting date
      </label>
      <input
        id="reporting-date"
        type="date"
        value={draft}
        max={max}
        onChange={(event) => {
          setDraft(event.target.value);
          apply(event.target.value);
        }}
        aria-describedby="reporting-date-help"
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <span id="reporting-date-help" className="text-xs text-muted-foreground">
        {isPending ? 'Updating…' : 'Salaries are shown as of this date.'}
      </span>
    </div>
  );
}
