import type { ReactNode } from 'react';
import { Navigation } from './navigation';
import { UserBadge } from './user-badge';

/**
 * The global application shell (D-012, UX-JOURNEY.md §2).
 *
 * A persistent sidebar on desktop, with the page content in a landmark that
 * the skip link targets. The shell is a server component; only the navigation
 * link needs client behaviour, because it depends on the current pathname.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-7xl">
      <header className="hidden w-60 shrink-0 flex-col gap-6 border-r border-border py-6 pr-4 lg:flex">
        <div className="px-3">
          <p className="text-base font-semibold tracking-tight">Your HR</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Compensation workspace
          </p>
        </div>

        <Navigation />

        <div className="mt-auto px-3">
          <UserBadge />
        </div>
      </header>

      <main id="main-content" className="min-w-0 flex-1 py-6 lg:pl-8">
        {children}
      </main>
    </div>
  );
}
