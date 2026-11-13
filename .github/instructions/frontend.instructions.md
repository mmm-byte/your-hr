---
applyTo: "src/app/**/*.tsx,src/components/**/*.tsx,src/components/**/*.ts,src/styles/**/*.css"
---
# Your HR Frontend Instructions

Read `/AGENTS.md`, `/docs/UI.md`, `/docs/FEATURES.md`, `/docs/UX-JOURNEY.md`, and the nearest folder `README.md` first.

## Boundaries
- Start with a Server Component. Add `use client` only for state, events, effects, browser APIs, or interactive third-party UI.
- Keep client boundaries at interactive leaves. Never import database/server-secret modules into client code.
- Page/layout modules compose data and product components; do not bury domain rules in JSX.
- **No auth layer.** Do not build a login page, session handling, or a sign-out control (ACC-001). The single assumed persona is the HR Manager; actions are attributed to the fixed `hr-manager` surrogate (D-011).
- **Routes are canonical.** `/` is Overview; there is no `/overview`. Follow the route map in `docs/UX-JOURNEY.md` §2 and the decision D-012.
- **State lives in the URL.** Filters and the reporting date are URL search parameters, so deep links, refresh, and browser back/forward all work (RPT-003, QRY-006).
- The salary revision is a **dedicated page**, not a modal — it needs its own loading, error, pending, conflict, and success states.

## Design system
- Use Tailwind and existing shadcn/ui primitives. Use Lucide icons only.
- Reuse product components such as MoneyDisplay, StatusBadge, EmployeeIdentity, FilterBar, DataTable, EmptyState, and ErrorState before creating new ones.
- Do not add another design system, icon package, chart library, or arbitrary color palette.
- Maintain one restrained enterprise visual language: neutral surfaces, blue primary, semantic green/amber/red.
- Avoid decorative gradients, glassmorphism, excessive animation, emoji icons, and one-off pixel values.

## Data and display
- Never fetch all 10,000 employees into the browser. Search, filtering, sorting, and pagination are server-side.
- Money always uses centralized formatting and explicit currency. Never hand-concatenate symbols or silently combine currencies.
- **Never render a mixed-currency total** (RPT-007). A total is single-currency, or an explicitly labelled synthetic USD equivalent.
- Label the USD equivalent as *"USD equivalent (synthetic)"* (MON-005, RPT-005).
- **Dates are date-only.** Never construct a `Date` from a `YYYY-MM-DD` value — it shifts the calendar day across time zones (RPT-004).
- State the reporting date in words on every surface showing money, and label a future-effective record "Scheduled" (SAL-008, RPT-002).
- Props are product/view models, not raw Drizzle rows.

## Required states
Every server-backed surface defines:
- loading
- populated
- empty data
- no filter matches
- not found where applicable
- safe error + recovery/retry

Every mutation defines:
- idle
- pending/disabled
- validation error
- business-rule error
- conflict/stale state
- unexpected error
- success
- duplicate-submit prevention

Use the **stable error codes** from `docs/DECISIONS.md` D-017. Each code maps to one specific recovery action;
messages are never free text. Map codes to messages in one place, not per call site.

## Accessibility
- Semantic headings and landmarks.
- Every control has an accessible name/label.
- Keyboard-operable menus, dialogs, tabs, tables, and forms.
- Visible focus; restore focus after dialogs where appropriate.
- Status is not conveyed by color alone.
- Field errors are associated with fields, and the first invalid field receives focus.
- Charts include text labels/summary and remain comprehensible without color.
- Respect reduced motion and maintain readable contrast/touch targets.
- A "Skip to main content" link is the first focusable element.

## Responsive behavior
Preserve identity, status, role, location, and salary first. Move secondary table data into details rather than shrinking text. Below 768 px the directory table becomes a card list. Verify narrow viewport and long names/job titles.

## Testing
Add focused component tests for interaction, accessible roles/names, validation, pending/error states, and formatting. Critical user journeys belong in E2E. Update `tests/TEST-MATRIX.md`.
