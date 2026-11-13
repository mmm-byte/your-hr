# Your HR — Domain Rules

## Rule language
**MUST** = invariant. **SHOULD** = default with documented exception. **MAY** = optional behavior.

## Employee
- EMP-001: Employee ID MUST be unique and immutable.
- EMP-002: Employee email MUST be unique when used as a corporate identifier.
- EMP-003: Hire date MUST exist.
- EMP-004: Termination date MUST NOT precede hire date.
- EMP-005: `active` and `on_leave` employees MUST NOT have a termination date.
- EMP-006: `terminated` employees MUST have a termination date.
- EMP-007: Country and branch MUST be valid configured references; branch MUST belong to the employee's country.
- EMP-008: Job level MUST remain within configured supported levels.
- EMP-009: Historical records remain queryable after termination.

## Money and currency
- MON-001: Every money value MUST carry/derive an explicit ISO-style currency code.
- MON-002: Authoritative money calculations MUST use exact decimal/integer-minor-unit semantics, never binary floating point.
- MON-003: Display MUST use a central currency formatter; symbols MUST NOT be manually concatenated.
- MON-004: Sums across currencies MUST NOT be presented as a single total unless an explicit reporting-currency conversion is applied.
- MON-005: Localized salary and USD-equivalent are distinct concepts and MUST be labeled.
- MON-006: Fixed seed FX/localization metadata MUST NOT be represented as live market rates.

## Salary history
- SAL-001: Every seeded employee MUST have at least one salary record.
- SAL-002: Base salary MUST be greater than zero.
- SAL-003: Bonus percentage MUST be within 0–100 inclusive; UI MAY impose a narrower product policy later if documented.
- SAL-004: Salary effective date MUST NOT precede hire date.
- SAL-005: A salary revision MUST append a new effective-dated record; it MUST NOT rewrite prior historical records.
- SAL-006: Two salary records for the same employee MUST NOT share the same effective date after validation/import.
- SAL-007: Current salary means the latest salary effective on the chosen reporting date, not simply the row with the greatest ID.
- SAL-008: A future-effective revision MAY exist but MUST be clearly labeled as scheduled and MUST NOT become current early.
- SAL-009: Salary revision requires a human-readable reason in application-created records.
- SAL-010: Mutation that creates salary history and its audit record MUST be atomic.
- SAL-011: Concurrent stale updates MUST fail with a conflict rather than silently overwrite newer data.
- SAL-012: Salary after employment termination SHOULD be rejected unless the record represents a documented correction permitted by a future requirement.

## Absence
- ABS-001: Start/end dates are required; end MUST NOT precede start.
- ABS-002: Duration MUST be positive.
- ABS-003: Absence data is contextual and MUST NOT automatically determine salary changes.
- ABS-004: Multiple records per employee are expected.

## Performance
- PERF-001: Review rating uses the seeded supported range.
- PERF-002: Goals-met percentage MUST remain 0–100.
- PERF-003: Promotion recommendation is contextual; the application MUST NOT automatically alter salary because of it.

## Attrition
- ATT-001: Attrition/departure context belongs to historical employment truth.
- ATT-002: Departed employees MUST remain searchable when a status filter includes them.
- ATT-003: Exit interview data MUST NOT modify compensation automatically.

## Analytics
- ANA-001: Every analytical result MUST have explicit scope/filter semantics.
- ANA-002: Headcount defaults to current active/on-leave workforce unless UI explicitly includes terminated employees.
- ANA-003: Median must use mathematically correct handling for even/odd sets.
- ANA-004: Empty result sets return an empty state, not a fabricated zero salary.
- ANA-005: Currency-sensitive metrics MUST be grouped by currency or converted through the documented reporting policy.
- ANA-006: Reporting-date queries MUST use effective-dated salary state as of that date.
- ANA-007: Filters/search/sort/pagination over the 10,000-person directory execute server-side.

## Audit and safety
- AUD-001: Salary mutations MUST produce append-only audit evidence.
- AUD-002: Application audit events MUST capture actor surrogate, action, entity, timestamp, correlation ID, and enough before/after context to explain the change without leaking unnecessary sensitive data.
- AUD-003: Application logs MUST NOT dump full salary payloads, database URLs, secrets, or CSV records.
- AUD-004: Unexpected errors exposed to users MUST be generic and MAY include a correlation ID; stack traces remain server-side.

## Access and identity
- ACC-001: The MVP MUST NOT implement a login page, session store, or authentication provider; the user is the assumed HR Manager persona.
- ACC-002: The application MUST display a persistent notice that it runs without authentication and contains synthetic data.
- ACC-003: Every mutation MUST attribute the action to a stable actor surrogate. With no authenticated principal, the surrogate MUST be the documented fixed persona identifier (`hr-manager`).
- ACC-004: The absence of authentication MUST be stated in the security documentation as a limitation, not implied to be a production control.

## Reporting and display
- RPT-001: The reporting date MUST default to the current calendar date and MUST be selectable by the user.
- RPT-002: Every surface that displays money MUST state the reporting date in words, and MUST label a salary as "current" or "scheduled" according to SAL-007/SAL-008.
- RPT-003: Reporting date and all directory filters MUST be carried in the URL so a shared link reproduces the same view.
- RPT-004: Date-only values (hire date, effective date, termination date, reporting date) MUST NOT shift across time zones. A date rendered in any locale MUST denote the same calendar day that was stored.
- RPT-005: Money MUST be rendered through one central formatter that includes the ISO currency code; symbols MUST NOT be concatenated manually (refines MON-003).
- RPT-006: Average and median values MUST be rounded only for display. The unrounded database value MUST remain the source of truth.
- RPT-007: Any displayed total MUST either cover a single currency or be an explicitly labelled synthetic USD equivalent. A mixed-currency sum MUST NOT be displayed (refines MON-004).

## Salary mutation eligibility
- ELG-001: A salary revision MUST be rejected when the employee's employment status is `terminated`.
- ELG-002: A salary revision effective after the employee's termination date MUST be rejected (refines SAL-012).
- ELG-003: A salary revision effective before the employee's hire date MUST be rejected (refines SAL-004).
- ELG-004: A salary revision MUST NOT change the employee's currency. Currency is fixed by the employee's modelled country/branch policy.
- ELG-005: The salary revision surface MUST be unavailable, not merely disabled-with-reason, for employees who are not eligible to be revised.
- ELG-006: A terminated employee's salary MUST remain fully inspectable, labelled as the salary effective as of termination (refines EMP-009).

## Concurrency
- CON-001: A salary revision MUST carry the employee compensation version the user was shown. The server MUST reject the write when the stored version differs, returning a conflict rather than overwriting (refines SAL-011).
- CON-002: A conflict response MUST preserve the user's submitted input so the revision can be re-applied after review.
- CON-003: The version token MUST be incremented on every successful salary revision.

## Search and filtering
- QRY-001: Directory search MUST match employee ID, full name, and email, trimmed and case-insensitively.
- QRY-002: Search MUST treat `%`, `_`, `'`, and `\` as literal characters, never as SQL wildcards or escape sequences.
- QRY-003: Invalid or unknown filter values supplied by the user MUST be ignored in favour of a documented default, and MUST NOT cause an error.
- QRY-004: Page size MUST be bounded to a documented maximum, and page numbers beyond the last page MUST return an empty result with a safe navigation affordance, never an error.
- QRY-005: Sort fields MUST be selected from an explicit allow-list. Any other value MUST fall back to the documented default sort.
- QRY-006: Applying, changing, or clearing any filter MUST reset pagination to the first page.
- QRY-007: An empty result MUST distinguish "no data exists" from "no rows match the current filters".

## Seed modelling assumptions
- SEED-001: Absence data MUST be represented as a seeded summary (record count and total days). The application MUST NOT fabricate individual dated absence events that do not exist in the source.
- SEED-002: Performance context MUST be represented as the latest seeded review only. The application MUST NOT fabricate historical review records.
- SEED-003: Any absence or performance figure surfaced in the UI MUST be labelled as a seed summary rather than as event history.
- SEED-004: Salary currency MUST remain stable across all of an employee's salary records; a revision that would change currency MUST be rejected.

