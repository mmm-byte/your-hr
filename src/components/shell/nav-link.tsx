'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import type { ReactNode } from 'react';

/**
 * A navigation link that knows whether it is the current section.
 *
 * The active item is marked with `aria-current="page"` **and** a visual
 * treatment — never colour alone (UI.md → Accessibility). The icon also
 * changes weight so the state is not conveyed by hue.
 */
export function NavLink({
  href,
  children,
}: {
  href: Route;
  children: ReactNode;
}) {
  const pathname = usePathname();

  // `/` must match exactly; every other route matches on a segment boundary, so
  // `/employees` is active on `/employees/42` but `/employeesx` is not.
  //
  // `usePathname()` can be null outside a router context (for example when a
  // component is rendered in isolation), so the comparison is null-safe.
  const isActive =
    pathname === null
      ? false
      : href === '/'
        ? pathname === '/'
        : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary-subtle text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <span className={isActive ? 'font-semibold' : 'font-normal'}>
        {children}
      </span>
    </Link>
  );
}
