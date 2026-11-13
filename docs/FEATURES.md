# Your HR — Feature Contract

## Priority model
**P0** is required for a coherent assessment. **P1** improves the product if P0 is stable. **P2** is intentionally deferable.

## P0 — Foundation
### Global shell
- Product navigation: Overview, Employees, Compensation, Analytics, Data Quality.
- Assumed HR Manager identity displayed as assessment context.
- Responsive layout, accessible navigation, consistent errors/toasts.
- Persistent assessment notice stating synthetic data and no authentication (ACC-002).
- Skip link, focus-visible styles, and `aria-current` on the active nav item.
- Root `not-found.tsx` and a route-scoped employee `not-found.tsx`.

### Overview
- Workforce count/status summary.
- Compensation summary that respects currencies/reporting policy.
- Country/branch and department workforce context.
- Recent/meaningful salary changes.
- Data-quality attention count.
- Every metric card links to the filtered view that explains it.
- Reporting date stated in words and selectable (RPT-001).

### Employee directory
- Search employee ID/name/email.
- Filters: country, branch, department, level, status, work mode.
- Server-side sort and pagination.
- URL-persisted filter state when practical.
- Columns prioritize identity, role/org context, current salary/currency, status.
- Dependent Country → Branch filter behaviour.
- Three distinct empty states: no data, no search match, no filter match (QRY-007).

### Employee profile
- Employment overview.
- Current compensation.
- Effective-dated salary history.
- Supporting tabs/sections for performance, absences, attrition/history.
- Salary revision entry point for eligible employees only (ELG-005).
- Terminated employees remain fully inspectable, with no revision action (ELG-001, ELG-006).
- Absence and performance shown as labelled seed summaries, never fabricated history (SEED-003).

### Salary revision
- New salary, bonus percentage, effective date, reason.
- Preview current vs proposed values.
- Explicit currency.
- Validation, double-submit protection, concurrency conflict handling.
- Transactional salary record + audit event.
- Clear successful confirmation and updated history.
- Dedicated route (not a modal) with preserved context and a "Back to employee" link.
- Stale-edit response preserves the user's input for re-application (CON-002).

### Compensation
- Current salary population with filters.
- Aggregates grouped appropriately by currency/country/department/level.
- Salary distribution and change context where useful.

### Analytics
- A small number of decision-useful predefined analytics, not a BI builder.
- Headcount by country/department/status.
- Median/average salary by valid grouping and currency/reporting policy.
- Salary distribution by level/department/country.
- Reporting-date support only if reliably implemented.
- Every chart has a text summary and a table alternative.

### Data quality
- Missing/inconsistent required fields.
- Currency/country mismatches.
- salary/history anomalies detectable by rules.
- Clear count + affected employee navigation.
- Findings labelled "needs review", not corruption.

## P1 — Useful polish
- CSV export of current filtered employee/compensation view with spreadsheet-injection-safe serialization.
- Saved/shareable URL filters.
- Side-by-side compensation change explanation.
- Small benchmark/performance page in docs rather than UI.

> **Export scope note:** CSV export is P1 and is **not** required for P0 completeness. If it is not built,
> the export control is hidden entirely and `EXPORT_NOT_AVAILABLE` (D-017) is returned if the route is
> probed. The API-CONTRACT, SECURITY, and TESTING documents already specify its behaviour so it can be
> added later without redesign.

## P2 — Do not prioritize unless P0/P1 are complete
- Natural-language analytics mapped to allow-listed query structures.
- Authentication/SSO.
- Fine-grained RBAC.
- Bulk import workflow.
- Approval workflow.

## Explicitly not features
Payroll processing, benefits, tax, employee self-service, shift scheduling, time clock, document vault, ATS, LMS, live FX, salary prediction, attrition prediction, or performance-driven automatic pay decisions.

## Feature acceptance standard
A feature is not complete when the happy path renders. It is complete when:
- domain acceptance criteria pass
- server validation exists
- loading/empty/error/success states exist where applicable
- keyboard/accessibility basics are met
- data access is scoped and performant
- relevant tests pass
- no undocumented architecture/dependency was introduced
