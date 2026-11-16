# Your HR Test Matrix

Update this file as implementation paths become real. A blank cell requires an explicit reason.

Rule groups: `EMP` employee · `MON` money/currency · `SAL` salary history · `ABS` absence ·
`PERF` performance · `ATT` attrition · `ANA` analytics · `AUD` audit · `ACC` access ·
`RPT` reporting/display · `ELG` revision eligibility · `CON` concurrency · `QRY` search/filter ·
`SEED` seed assumptions.

**Cell notation.** A path means the test exists and runs today. `planned (Phase N)`
means the capability is specified but not yet implemented, with the phase that
owns it — the gap is explicit, never silently blank. `—` means the layer is
deliberately not applicable for that capability (see the non-applicable table).

| Capability / rule | Unit | Integration | Component | E2E | Edge cases / notes |
|---|---|---|---|---|---|
| EMP-001 unique employee ID | — | tests/integration/schema.test.ts | — | — | DB constraint + seed verify |
| EMP-004 termination >= hire | tests/unit/employment.test.ts | tests/integration/schema.test.ts | — | — | boundary equal dates |
| MON-001 explicit currency | tests/unit/money.test.ts | — | tests/component/product.test.tsx | planned (Phase 6) | every money value carries a code |
| MON-004 multi-currency totals | tests/unit/money.test.ts, tests/unit/analytics.test.ts | — | tests/component/product.test.tsx | planned (Phase 6) | grouped vs reporting equivalent |
| MON-002 exact decimal | tests/unit/money.test.ts, tests/unit/salary-rules.test.ts | tests/integration/schema.test.ts | — | — | no float round-trip; string preserved |
| SAL-005 append-only revision | — | tests/integration/salary-revision.test.ts | — | planned (Phase 6) | old history unchanged; the prior rows are never rewritten |
| SAL-006 duplicate effective date | tests/unit/salary-rules.test.ts | tests/integration/salary-revision.test.ts, tests/integration/salary-revision-action.test.ts | tests/component/salary-revision-form.test.tsx | planned (Phase 6) | conflict mapping → SALARY_EFFECTIVE_DATE_CONFLICT; a duplicate is also warned about before submitting |
| SAL-007 current salary as-of date | tests/unit/current-salary.test.ts | tests/integration/current-salary.test.ts, tests/integration/rendered-profile.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | past/current/future/equal date |
| SAL-008 scheduled label | tests/unit/current-salary.test.ts | tests/integration/current-salary.test.ts, tests/integration/rendered-profile.test.ts | — | planned (Phase 6) | future revision never shown as current; the scheduled block is labelled and separate |
| SAL-010 salary + audit atomicity | — | tests/integration/salary-revision.test.ts | — | planned (Phase 6) | forced audit failure rollback: zero salary rows and an unchanged version |
| SAL-011 stale update conflict | tests/unit/salary-rules.test.ts | tests/integration/salary-revision.test.ts, tests/integration/salary-revision-action.test.ts | tests/component/salary-revision-form.test.tsx | planned (Phase 6) | two editor simulation; exactly one of two concurrent writers wins (D-033) |
| ANA-003 median | tests/unit/analytics.test.ts | tests/integration/compensation.test.ts | — | planned (Phase 6) | empty/one/odd/even; the even-length set is the mean of the two middle values |
| ANA-004 empty not zero | tests/unit/analytics.test.ts | tests/integration/compensation.test.ts | — | planned (Phase 6) | empty aggregate → an empty array, never a fabricated zero |
| ANA-007 server-side query | — | tests/integration/employee-directory.test.ts, tests/integration/seeded-directory.test.ts, tests/integration/rendered-directory.test.ts, tests/integration/compensation.test.ts | — | tests/e2e/directory.spec.ts | 10k rows never in browser; the rendered page links 25 profiles |
| ACC-001 no auth layer | — | — | tests/component/shell.test.tsx | tests/e2e/navigation.spec.ts | no login route; no session cookie |
| ACC-002 assessment notice | — | — | tests/component/shell.test.tsx | tests/e2e/navigation.spec.ts | visible on every page |
| ACC-003 actor surrogate | tests/unit/actor.test.ts | tests/integration/salary-revision.test.ts | — | — | audit actor = `hr-manager` |
| RPT-001 reporting date default | tests/unit/date-only.test.ts, tests/unit/employee-directory-schema.test.ts, tests/unit/url-state.test.ts | tests/integration/current-salary.test.ts | tests/component/directory.test.tsx | — | defaults to today; a malformed or future date is ignored |
| RPT-003 URL-carried state | tests/unit/employee-directory-schema.test.ts, tests/unit/url-state.test.ts | tests/integration/rendered-directory.test.ts | tests/component/directory.test.tsx | tests/e2e/directory.spec.ts | filters + asOf survive refresh/back |
| RPT-004 date-only, no TZ shift | tests/unit/date-only.test.ts, tests/unit/date-parsers.test.ts | tests/integration/date-parsers.test.ts | — | — | same calendar day in any locale; six timezones (D-021) |
| RPT-006 display rounding | tests/unit/money.test.ts | — | tests/component/product.test.tsx | — | DB value remains source of truth |
| RPT-007 no mixed-currency total | tests/unit/money.test.ts, tests/unit/analytics.test.ts | tests/integration/compensation.test.ts | — | tests/e2e/analytics.spec.ts | every total single-currency or labelled; the page shows no figure crossing currencies |
| ELG-001 terminated not revisable | tests/unit/salary-rules.test.ts | tests/integration/salary-revision.test.ts, tests/integration/salary-revision-action.test.ts | — | planned (Phase 6) | `SALARY_NOT_ELIGIBLE`; the gate runs inside the transaction, not only in the domain layer (D-034) |
| ELG-002/003 date window | tests/unit/salary-rules.test.ts | tests/integration/salary-revision-action.test.ts | tests/component/salary-revision-form.test.tsx | planned (Phase 6) | before hire / after termination |
| ELG-004 currency fixed | tests/unit/salary-rules.test.ts | tests/integration/salary-revision.test.ts, tests/integration/salary-revision-action.test.ts | tests/component/salary-revision-form.test.tsx | planned (Phase 6) | submitted currency cannot change policy |
| ELG-005 no revision surface | — | tests/integration/salary-revision-action.test.ts | tests/component/salary-revision-form.test.tsx | tests/e2e/profile.spec.ts | absent for terminated employees; the form is not rendered at all, and the server refuses the write as well |
| ELG-006 terminated history visible | tests/unit/employment.test.ts | tests/integration/current-salary.test.ts, tests/integration/rendered-profile.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | labelled as-of termination: the card says "Final salary" and "Effective as of termination" |
| CON-001 version conflict | tests/unit/salary-rules.test.ts | tests/integration/salary-revision.test.ts, tests/integration/salary-revision-action.test.ts | tests/component/salary-revision-form.test.tsx | planned (Phase 6) | stale write rejected, nothing written |
| CON-002 conflict preserves input | — | tests/integration/salary-revision-action.test.ts | tests/component/salary-revision-form.test.tsx | planned (Phase 6) | user can re-apply after refresh (D-035) |
| CON-003 version increments | — | tests/integration/salary-revision.test.ts | — | — | increments on success only; a failed write leaves the version unchanged |
| QRY-001 search fields | tests/unit/query-params.test.ts | tests/integration/employee-directory.test.ts, tests/integration/seeded-directory.test.ts | — | tests/e2e/directory.spec.ts | ID/name/email |
| QRY-002 literal wildcards | tests/unit/query-params.test.ts | tests/integration/employee-directory.test.ts | — | planned (Phase 6) | `%`, `_`, `'`, `\` are literal |
| QRY-003 invalid filter ignored | tests/unit/employee-directory-schema.test.ts, tests/unit/compensation-analytics-schema.test.ts | tests/integration/employee-directory.test.ts | — | — | falls back to default, no error |
| QRY-004 page bounds | tests/unit/query-params.test.ts | tests/integration/employee-directory.test.ts | tests/component/directory.test.tsx | tests/e2e/directory.spec.ts | page beyond last → empty with a pager, not an error |
| QRY-005 sort allow-list | tests/unit/employee-directory-schema.test.ts, tests/unit/compensation-analytics-schema.test.ts | tests/integration/employee-directory.test.ts, tests/integration/seeded-directory.test.ts | tests/component/directory.test.tsx | tests/e2e/directory.spec.ts | unknown sort → default; the salary sort uses the USD equivalent so six currencies are comparable (D-031) |
| QRY-006 filter resets page | tests/unit/url-state.test.ts | tests/integration/employee-directory.test.ts | tests/component/directory.test.tsx | tests/e2e/directory.spec.ts | change filter → page 1 |
| QRY-007 empty distinction | — | tests/integration/employee-directory.test.ts, tests/integration/seeded-directory.test.ts | tests/component/product.test.tsx | planned (Phase 6) | no data vs no filter match |
| SEED-001 absence summary | tests/unit/seed-dataset.test.ts | tests/integration/seed.test.ts | tests/integration/rendered-profile.test.ts | — | no fabricated dated events |
| SEED-003 summary labelled | — | tests/integration/rendered-profile.test.ts | — | planned (Phase 6) | UI says "seed summary" |
| SEED-004 stable currency | tests/unit/seed-dataset.test.ts | tests/integration/seed.test.ts | — | — | 0 employees change currency (verified) |
| Employee directory | tests/unit/url-state.test.ts | tests/integration/employee-directory.test.ts, tests/integration/seeded-directory.test.ts, tests/integration/rendered-directory.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | filtering/sort/page bounds; the responsive priority is held by the row-details block |
| Employee profile | — | tests/integration/current-salary.test.ts, tests/integration/rendered-profile.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | not-found/terminated/no support records |
| Salary revision flow | tests/unit/salary-rules.test.ts | tests/integration/salary-revision.test.ts, tests/integration/salary-revision-action.test.ts | tests/component/salary-revision-form.test.tsx | tests/e2e/revision.spec.ts | pending/double-submit/conflict/success; the browser write was proven against the seeded cohort on 2026-11-16 |
| Data quality | — | tests/integration/compensation.test.ts | — | planned (Phase 6) | deterministic classification; the same data produces the same list in the same order |
| Seed invariants | tests/unit/csv.test.ts, tests/unit/seed-dataset.test.ts | tests/integration/seed.test.ts | — | — | repeat run, orphan, duplicate; `pnpm db:verify` 29/29 |
| Health endpoint | tests/unit/health-route.test.ts | — | — | planned (Phase 6) | reachable and degraded responses are safe; deployment reachability remains E2E/production work |
| Error code catalogue | tests/unit/error-codes.test.ts | — | tests/component/error-boundary.test.tsx, tests/component/directory.test.tsx | planned (Phase 6) | every D-017 code maps to a UI recovery; the raw database message never reaches the reader |

## Phase 1 coverage (complete 2026-11-13)
The data layer is covered end to end. `pnpm db:verify` asserts 29 invariants against a
real PostgreSQL instance and exits non-zero on any violation; `tests/integration/schema.test.ts`
covers the database constraints; `tests/integration/seed.test.ts` covers the seeded cohort;
and `tests/integration/date-parsers.test.ts` covers the timezone-safe date decoding that
D-021 introduced. A cell still marked `planned (Phase N)` belongs to a later phase and is
not a gap in Phase 1.

## Phase 2 coverage (complete 2026-11-13)
The domain core is covered by 214 unit tests that run in under half a second and need no
database. Every Phase 2 rule ID has at least one unit test:

| Rule | Owning test file |
|---|---|
| MON-001, MON-002, MON-003, MON-004, RPT-005, RPT-006 | `tests/unit/money.test.ts` |
| ANA-003, ANA-004, ANA-005, RPT-007 | `tests/unit/analytics.test.ts` |
| SAL-002…004, SAL-006, SAL-009, SAL-012, ELG-001…004, CON-001 | `tests/unit/salary-rules.test.ts` |
| SAL-007, SAL-008, ANA-006, RPT-001, RPT-002 | `tests/unit/current-salary.test.ts` |
| EMP-003…006, EMP-009, ELG-006 | `tests/unit/employment.test.ts` |
| RPT-004 | `tests/unit/date-only.test.ts` |
| D-017 | `tests/unit/error-codes.test.ts` |
| ACC-003 | `tests/unit/actor.test.ts` |
| MON-001, QRY-003, QRY-005, D-024 | `tests/unit/domain-values.test.ts` |
| QRY-003, QRY-004, QRY-005 | `tests/unit/query-params.test.ts` |
| QRY-001…005, RPT-003, RPT-004 | `tests/unit/employee-directory-schema.test.ts` |
| ANA-001, ANA-005, QRY-003, QRY-005 | `tests/unit/compensation-analytics-schema.test.ts` |

Four defects found during Phase 2 are now covered by regression tests: a negative amount
round-trip, a third decimal place being silently truncated, a malformed amount rendering
as `$NaN`, and a currency total that could not enforce its own single-currency rule
(D-026). A cell still marked `planned (Phase N)` belongs to a later phase and is not a gap
in Phase 2.

## Phase 4 coverage (complete 2026-11-16)
The write path is covered at every layer it has a behaviour at: 15 integration tests
over the transaction, 11 over the server action, and 14 over the form. Every Phase 4
rule ID has at least one test:

| Rule | Owning test file |
|---|---|
| SAL-005, SAL-006, SAL-010, SAL-011, CON-001, CON-003 | `tests/integration/salary-revision.test.ts` |
| AUD-001, AUD-002, AUD-003 (audit shape and actor) | `tests/integration/salary-revision.test.ts` |
| ELG-001, ELG-002/003, ELG-004, ACC-001…004 (the action's boundary) | `tests/integration/salary-revision-action.test.ts` |
| AUD-004 (no raw database message reaches the reader) | `tests/integration/salary-revision-action.test.ts` |
| ELG-004, UX-JOURNEY Step 6 (the live comparison and the warnings) | `tests/component/salary-revision-form.test.tsx` |
| CON-002, SAL-006, SAL-009 (the reader's side of a refusal) | `tests/component/salary-revision-form.test.tsx` |

Three defects found while building Phase 4 are now covered by regression tests: the FX
scale arithmetic used the decimal count as the multiplier, the duplicate-date check
accepted *any* unique violation rather than the one named constraint, and the browser
does not submit a **disabled** input — so the fixed currency was being dropped from the
submission entirely. A cell still marked `planned (Phase N)` belongs to a later phase
and is not a gap in Phase 4.

## Phase 5 coverage (complete 2026-11-16)
The analytics surfaces are covered by 21 integration tests over the query layer.
Every rule the phase owns has at least one test:

| Rule | Owning test file |
|---|---|
| ANA-001 the workforce summary states its scope and splits by status | `tests/integration/compensation.test.ts` |
| ANA-002 a headcount describes the current workforce unless terminated employees are included | `tests/integration/compensation.test.ts` |
| ANA-003 the median is correct for even and odd sets | `tests/integration/compensation.test.ts`, `tests/unit/analytics.test.ts` |
| ANA-004 an empty selection is an empty array, never a fabricated zero | `tests/integration/compensation.test.ts`, `tests/unit/analytics.test.ts` |
| ANA-005 a salary figure is stated within one currency; no total crosses currencies | `tests/integration/compensation.test.ts` |
| ANA-006 the aggregates read the current, effective-dated salary | `tests/integration/compensation.test.ts` |
| ANA-007 the population is filtered and paged on the server | `tests/integration/compensation.test.ts` |
| MON-002 a median carries exactly two decimals, never float noise | `tests/integration/compensation.test.ts`, `tests/unit/money.test.ts` |
| MON-004, MON-005, MON-006 no mixed total; local and equivalent stay distinct | `tests/integration/compensation.test.ts` |
| QRY-007 "no data" is distinguished from "no rows match" | `tests/integration/compensation.test.ts` |
| SAL-007, SAL-008 the current salary is the latest effective record; a future one is scheduled | `tests/integration/compensation.test.ts` |
| The data-quality rules, and their determinism | `tests/integration/compensation.test.ts` |

Three rules are **not** covered by a data-quality test, and the coverage header says
why: the schema's unique index and CHECK constraints forbid the states that
`duplicate-effective-date`, `missing-termination-date`, and
`active-with-termination-date` look for, so a test for them would have to defeat the
constraints to exist. The rules are still implemented, so the work queue stays
honest if the data ever arrives from somewhere else.

## Phase 6 coverage (in progress — 2026-11-16)
The E2E suite passes: **22 browser tests** completed in **19.1 seconds** against a
freshly seeded, file-backed PGlite cohort. Its global setup builds the standalone
application and its teardown stops the exact server it started, so a later run cannot
silently exercise a stale build on the same port. The remaining Phase 6 work is
production deployment and the final manual accessibility/responsive review.

| Journey | Spec file |
|---|---|
| The directory: one bounded page, the result count, search, sort, the pager, and the URL carrying the state | `tests/e2e/directory.spec.ts` |
| The shell: the assessment notice, the skip link, every nav destination, and the unknown-route page | `tests/e2e/navigation.spec.ts` |
| The profile: the identity, the current salary with its currency, the history, and the terminated employee's missing revision action | `tests/e2e/profile.spec.ts` |
| The revision: the read-only current salary, the fixed currency, the live comparison, the refused invalid amount, and the written revision | `tests/e2e/revision.spec.ts` |
| The analytics surfaces: the currency grouping, the question the URL asks, the narrowing grouping options, the chart's text alternative, and the data-quality links | `tests/e2e/analytics.spec.ts` |

## Test layers and location
| Layer | Location | Database | Notes |
|---|---|---|---|
| Unit | `tests/unit/` | none | Pure domain rules. Must run in <5 s, no network, no clock dependency |
| Integration | `tests/integration/` | PGlite (D-009) | Real PostgreSQL semantics via `drizzle-orm/pglite`; applies the same generated migration SQL as Neon |
| Component | `tests/component/` | none (mocked server actions) | Interaction, accessible role/name, pending/error states, money formatting |
| E2E | `tests/e2e/` | Neon preview or seeded local | Playwright with `channel: 'chrome'` (D-010) |

## Non-applicable scenarios (explicit)
| Scenario | Why not covered | Where instead |
|---|---|---|
| Auth / RBAC / session | ACC-001 — no auth layer exists by design | N/A — documented boundary, not a gap |
| Live FX conversion | MON-006 — fixed seed FX only | SEED tests assert the fixed reference date |
| Payroll calculation | Outside product scope | N/A |
| Bulk import | Outside product scope | N/A |
| Notification dispatch | Not a product feature | N/A |
| Cross-browser matrix | Chromium (system Chrome) only, to fit the disk budget | Add when CI capacity allows (D-010) |
