import { UserRound } from 'lucide-react';
import { ACTOR_LABEL } from '@/lib/actor';

/**
 * The acting persona (D-011, ACC-002).
 *
 * Shows who the application believes is acting. It is labelled as an assessment
 * persona rather than a signed-in account, because there is no session — a
 * logout button here would imply one.
 */
export function UserBadge() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-subtle px-3 py-2">
      <UserRound aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{ACTOR_LABEL}</p>
        <p className="truncate text-xs text-muted-foreground">Assessment persona</p>
      </div>
    </div>
  );
}
