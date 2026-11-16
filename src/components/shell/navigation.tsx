import {
  BarChart3,
  Briefcase,
  LayoutDashboard,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { Route } from 'next';
import { NavLink } from './nav-link';

/**
 * Primary navigation (D-012, UI.md → Navigation).
 *
 * The five sections defined in `docs/FEATURES.md`. The order is fixed by the
 * product contract: Overview → Employees → Compensation → Analytics → Data
 * Quality. No page is added without a product requirement.
 *
 * `Route` is Next's generated route type, so a link to a page that does not
 * exist fails the type check instead of producing a 404 at runtime.
 */
export interface NavItem {
  readonly href: Route;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Briefcase },
  { href: '/compensation', label: 'Compensation', icon: Wallet },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/data-quality', label: 'Data Quality', icon: ShieldAlert },
];

export function Navigation() {
  return (
    <nav aria-label="Primary">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <NavLink href={item.href}>
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
