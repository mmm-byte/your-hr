# Your HR — UI/UX System

## Experience goal
A calm, information-dense HR workspace. It should feel like a serious internal product, not a marketing website and not a generic AI dashboard.

## Navigation
Desktop sidebar / compact mobile navigation:
1. Overview
2. Employees
3. Compensation
4. Analytics
5. Data Quality

Do not add pages without a product requirement.

**Navigation contract (D-012, UX-JOURNEY.md §2):**
- `/` is Overview. There is no `/overview` route and no redirect to one.
- The current section is marked with `aria-current="page"` **and** a visual indicator — never colour alone.
- "Skip to main content" is the first focusable element in the document.
- The sidebar is present on every page. The salary revision page is a full-page flow and shows a clear
  "Back to employee" link instead of relying on the sidebar alone.
- Every route renders correctly on a cold load (deep-linkable), and all filter/reporting-date state lives
  in the URL.

**Assessment notice (ACC-002):** a persistent, non-blocking banner on every page stating that the
environment is an assessment with synthetic data and no authentication. It must not obscure content or
push navigation off-screen.

## Layout rules
- Use shadcn/ui primitives + Tailwind; Lucide icons only.
- One restrained color system: neutral surfaces, blue primary, semantic green/amber/red only for meaning.
- Avoid decorative gradients, glassmorphism, excessive animation, or arbitrary shadows.
- Use consistent spacing tokens; no one-off pixel styling without cause.
- Prefer server components; client components only where interaction requires them.

## Money and date display
- **Money display (RPT-005):** one central formatter. Show the ISO currency code; a symbol may accompany
  it. Never hand-concatenate a symbol to a number.
- **USD equivalent (MON-005, RPT-007):** always labelled *"USD equivalent (synthetic)"*. Never "USD salary".
- **Mixed currency (RPT-007):** a total is shown only for a single currency, or as an explicitly labelled
  synthetic USD equivalent. A blended multi-currency number is never displayed.
- **Dates (RPT-004):** date-only semantics. A stored date renders as the same calendar day in every
  locale — no timezone shifting. Salary effective `2026-03-01` must never display as `28 Feb`.
- **Reporting date (RPT-002):** every surface showing money states the reporting date in words and labels
  a future-effective record as "Scheduled".
- **Rounding (RPT-006):** averages and medians are rounded for display only; the database value is the
  source of truth.

## Reusable product components
Before duplicating markup, prefer these product-level components:
- `PageHeader`
- `MetricCard`
- `StatusBadge`
- `MoneyDisplay`
- `CountryBranchLabel`
- `EmployeeIdentity`
- `FilterBar`
- `DataTable`
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `ConfirmDialog`
- salary-specific history/change components

## Page contracts
### Overview `/`
Top: page title + reporting context.
Cards: workforce, compensation, countries/branches, leave/data-quality indicators.
Then: useful country/department distributions and recent salary changes.
No vanity metric without a clear HR question.

### Employees `/employees`
Header: title + employee count.
Filter/search area.
Table with intentional columns; server pagination.
Row opens `/employees/[employeeId]`.
Empty filter result explains how to recover.

### Employee `/employees/[employeeId]`
Identity header with status, role, organization, location.
Sections/tabs:
- Overview
- Compensation
- Performance
- Absence
- Employment history/attrition where applicable
Primary action: revise salary only where allowed.

### Salary revision
Prefer a dedicated page/clear sheet only if it preserves context and accessibility.
Show:
- employee/current salary
- proposed salary + currency
- effective date
- bonus percentage
- computed difference for display only
- reason
- warnings/conflict errors
Confirmation must be explicit.

### Compensation `/compensation`
Filterable current compensation view + small set of meaningful aggregates. Never combine currencies without the documented reporting policy.

### Analytics `/analytics`
Use charts only when they explain a distribution/trend better than numbers/table. Every essential chart has a textual label/summary; data should remain understandable without color alone.

### Data Quality `/data-quality`
Issue categories with counts and affected employee links. Treat this as an operational work queue, not a decorative dashboard.

## States required on data surfaces
- Loading: skeleton matching content shape; avoid full-page spinners where partial structure can render.
- Empty: distinguish "no data" from "no filter matches".
- Error: plain-language explanation + retry/navigation when possible; never raw stack trace.
- Success: mutation toast/inline confirmation; focus remains predictable.
- Stale/concurrency conflict: explain that data changed and ask user to refresh/review.

## Accessibility
- Semantic headings, labels, buttons, links.
- Keyboard access for menus/dialogs/forms/tables.
- Visible focus.
- Form error text associated with fields.
- Do not encode status only with color.
- Respect reduced-motion preferences for optional motion.
- Maintain readable contrast and touch targets.

## Table UX
- Do not render all 10,000 employees at once.
- Sorting/filtering/pagination are server-driven.
- Maintain stable ordering to prevent page jitter.
- Long values truncate visually only when full value remains accessible.
- Salary column always includes correct currency formatting.

## Responsive priority
On small screens preserve, in order: identity, status, role, location, current salary, then secondary attributes. Move secondary table columns into row details rather than shrinking text excessively.
