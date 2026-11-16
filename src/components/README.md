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
- `product/salary-revision-form.tsx` — the salary revision form: the live comparison, the contextual warnings, the pending, success, validation-error, and conflict states, and the double-submit guard (SAL-009, CON-001, CON-002, UX-JOURNEY §3 Step 6).
- `product/aggregate-panel.tsx` — `AggregatePanel`, `CountGroupPanel`. Every aggregate is **grouped by currency**, and the panel is what makes that structural: a figure carries its currency code, and figures from different currencies are separate blocks. The USD-equivalent mode is labelled as such (MON-004, MON-005, ANA-005, RPT-007).
- `product/charts.tsx` — `HeadcountBarChart`. A chart is a **second way to read the figures**, never the only way: it carries an accessible name, and the table beside it holds the same numbers (D-036).
- `product/issue-list.tsx` — `IssueList`. The data-quality findings, each with a count and the affected employees linked. The framing is "needs review", never "corrupt" (FEATURES.md).
- `product/analytics-controls.tsx` — `AnalyticsControls`. The metric and the grouping, written to the URL. The grouping options are filtered to what the chosen metric supports, so the control never offers an invalid pairing (QRY-003, RPT-003).
- `product/empty-state.tsx`, `product/error-state.tsx`, `product/loading-skeleton.tsx`, `product/page-header.tsx` — the four states every data surface needs.

### The revision form
Three decisions are worth knowing before changing it:

- **The currency is `readOnly`, not `disabled`.** A disabled input is not submitted by the
  browser, so the fixed currency would be dropped from the submission and the server would
  have nothing to check (ELG-004).
- **A refusal carries the reader's entries back.** The form restores the submitted values
  into the fields, so a refused revision is a pause and not a retype (CON-002, D-035).
- **The comparison is exact.** The absolute and percentage change come from the decimal
  helpers in `@/lib/money`, never from a float subtraction, and the direction is stated in
  words as well as by an arrow (UI.md → Accessibility).

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
