import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

/**
 * Root not-found page (D-012).
 *
 * An unknown route renders the normal application shell with a plain-language
 * explanation and a way back. It is never a raw 500 and never a stack trace
 * (AUD-004).
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="flex flex-col items-start gap-4">
        <span className="flex size-11 items-center justify-center rounded-lg bg-muted">
          <FileQuestion aria-hidden="true" className="size-5 text-muted-foreground" />
        </span>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">That page could not be found</h1>
          <p className="text-sm text-muted-foreground">
            The address may be mistyped, or the page may have moved. The sections below are all
            available.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Return to overview
        </Link>
      </div>
    </div>
  );
}
