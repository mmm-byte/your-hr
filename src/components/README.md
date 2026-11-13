# `src/components` — UI Components

## Owns
Reusable product presentation and interaction components.

## Layers
- `ui/`: shadcn-generated primitives; avoid casual customization/forks.
- product components: `MoneyDisplay`, employee identity, salary history, filter bars, states.

## Product modules
- `product/money-display.tsx` — `MoneyDisplay`, `UsdEquivalentDisplay`, `BonusDisplay`. Every amount carries its currency code (MON-001, RPT-005).
- `product/employee-identity.tsx` — `EmployeeIdentity`, `CountryBranchLabel`, `JobTitleLabel`, `WorkModeLabel`, `DateFact`, `Fact`.
- `product/status-badge.tsx` — `StatusBadge`, `EmploymentStatusBadge`. Status is never carried by colour alone.
- `product/data-table.tsx` — `DataTable`, `Pagination`. Sorting is by link, so it works without JavaScript and produces a shareable URL; the narrow layout moves the secondary attributes into row details (UI.md → Responsive priority).
- `product/filter-bar.tsx` — the client component that writes the directory's filters into the URL (D-029).
- `product/reporting-date-picker.tsx` — the shared reporting-date control, carried as `?asOf=` (RPT-003).
- `product/salary-card.tsx` — `SalaryCard`, `SalaryHistoryEntry`. A terminated employee's salary is labelled as of termination (ELG-006).
- `product/empty-state.tsx`, `product/error-state.tsx`, `product/loading-skeleton.tsx`, `product/page-header.tsx` — the four states every data surface needs.

## Rules
- Reuse before create.
- No database access.
- No business mutation rules hidden in UI.
- Centralized money/date/status formatting.
- Props describe product concepts, not database row shapes.
- Accessibility and responsive behavior are part of the component contract.

## Comments
Document non-obvious component relationships, controlled/uncontrolled state decisions, accessibility reasoning, and which page/test owns behavior. Do not narrate JSX.

## Tests
Test behaviors: accessible names/roles, keyboard interaction, validation display, pending state, error recovery, and currency/date output. Avoid broad snapshots.
