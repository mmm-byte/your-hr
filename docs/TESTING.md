# Your HR — Testing Strategy

## Philosophy
Testing protects behavior and design decisions, not coverage vanity. Core domain behavior should be developed in small red → green → refactor increments when practical. Tests must be deterministic, readable, isolated, and fast at the appropriate layer.

## Test layers and locations
| Layer | Directory | Database | Runs when | Target runtime |
|---|---|---|---|---|
| Unit | `tests/unit/` | none | every save | < 5 s total |
| Integration | `tests/integration/` | PGlite (D-009) | pre-commit / CI | < 60 s total |
| Component | `tests/component/` | none (server actions mocked) | pre-commit / CI | < 30 s total |
| E2E | `tests/e2e/` | seeded environment | CI / release | < 5 min total |

Integration tests apply the **same Drizzle-generated migration SQL** that Neon receives, through
`drizzle-orm/pglite`. There is one schema source of truth and no second test database to maintain.

## Test layers
### Domain/unit tests — many and fast
No database/UI. Cover:
- money/currency rules (MON-001…006, RPT-005/006)
- salary effective-date selection (SAL-007, SAL-008, RPT-001/004)
- salary revision validation and eligibility (SAL-002…009, ELG-001…004)
- employment date/status invariants (EMP-003…006)
- analytics helpers such as median (ANA-003, ANA-004)
- data-quality rule classification
- date-only parsing with no timezone drift (RPT-004)
- the stable error-code catalogue and its recovery mapping (D-017)

### Database/integration tests — targeted
Real/Postgres-compatible test environment via PGlite. Cover:
- schema constraints
- repository/query filters (QRY-001…007)
- salary transaction + audit event atomicity
- optimistic concurrency/conflict (CON-001, CON-003)
- current-salary-as-of-date query
- aggregate correctness
- seed idempotency/verification
- currency stability across an employee's revisions (SEED-004)

### Component tests — focused
Cover interactive forms/filter controls only where behavior is meaningful:
- validation messages
- disabled/pending state
- accessible name/role behavior
- salary comparison display
- the three distinct empty states (QRY-007)
- conflict state preserving user input (CON-002)
- "seed summary" labelling for absence/performance (SEED-003)

### End-to-end — few critical journeys
1. Open application and employee directory.
2. Search/filter and find an employee.
3. Open profile and inspect current/history salary.
4. Revise salary successfully and see history/audit-consistent result.
5. Attempt invalid/stale revision and get a safe error/conflict.
6. View compensation/analytics with valid currency semantics.
7. View data-quality issue and navigate to affected employee.

Additional E2E journeys covering the gaps closed by the UX audit:
8. Deep-link a filtered directory view and confirm the filters are restored.
9. Open an unknown route and an unknown employee ID and confirm both show a designed 404, not a crash.
10. Change the reporting date and confirm a scheduled revision is labelled and not counted as current.
11. Confirm the assessment notice and navigation are present on every page.

## Edge-case catalogue
### Employee
- missing/not-found ID
- special characters / trimmed search
- page beyond last page
- invalid filter/sort value
- terminated/on-leave employee
- termination before hire rejected

### Salary
- zero/negative
- extremely large but schema-valid value
- excessive decimal precision
- unsupported/mismatched currency
- 0 and boundary bonus percentages
- effective before hire
- effective after termination
- duplicate effective date
- future effective salary
- revision equal to current
- stale employee/version
- double submit
- database failure between salary and audit insert: entire transaction rolls back

### Analytics
- no matches
- one record
- odd/even median
- multiple currencies
- terminated included/excluded
- historical reporting date
- effective date exactly equals reporting date
- invalid grouping metric rejected

### Absence/performance/attrition
- employee with none
- employee with many
- invalid ranges/dates rejected in seed/import validation
- terminated employee remains historically inspectable

### UI
- slow response
- server error
- empty result
- keyboard-only navigation
- narrow viewport
- long names/titles
- browser back/forward with URL filters

### Data/import/security
- seed run twice
- orphan foreign keys
- duplicate employee ID
- duplicate salary effective date
- missing environment variable
- CSV value beginning with `=`, `+`, `-`, or `@` when exported: neutralize spreadsheet formula injection

### Access, routing, and reporting date (added by the UX audit)
- no `/login` route exists and no session cookie is set
- assessment notice present on every page
- audit event carries the `hr-manager` actor surrogate
- unknown route → designed 404, not a crash
- unknown employee ID → route-scoped 404, not a 500
- deep link with filters → filters restored on load
- browser back/forward → filter state restored
- filter change → pagination resets to page 1
- page beyond the last page → empty result with navigation, not an error
- unknown filter or sort value in the URL → default applied, no error
- reporting date omitted → defaults to today
- reporting date in the URL → the same view is reproduced
- reporting date in the past → a future revision is labelled "Scheduled", not counted as current
- reporting date in the future → the scheduled revision becomes current at that date
- date-only value rendered under a non-UTC timezone → same calendar day
- terminated employee → no revision surface, and the server rejects a direct write
- revision effective before hire → rejected
- revision effective after termination → rejected
- revision with a currency different from the employee's policy → rejected, not silently overridden
- revision with a blank reason → rejected
- revision with a duplicate effective date → conflict, nothing written
- revision with a stale expected version → conflict, nothing written, user input preserved
- revision double-submitted → exactly one salary row written
- absence summary blank vs zero → "no absence records" vs "0 days across N records"

## Determinism rules
- Tests do not depend on current wall-clock time without an injected/fixed clock.
- Seed uses stable IDs and deterministic generation.
- No live FX/network calls in tests.
- Tests create and clean their own data or use transaction isolation.

## Performance verification
For representative 10,000-employee data, measure rather than claim:
- employee filtered list query
- employee profile/current salary query
- key analytics aggregate query
Capture environment and query-plan/index observations in `PERFORMANCE.md`.

## Definition of done
Relevant tests pass, lint/typecheck/build pass, new behavior has the smallest meaningful protective tests, and no flaky/time-dependent test is knowingly introduced.
