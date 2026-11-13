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
| SAL-005 append-only revision | — | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | old history unchanged |
| SAL-006 duplicate effective date | tests/unit/salary-rules.test.ts | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | conflict mapping → SALARY_EFFECTIVE_DATE_CONFLICT |
| SAL-007 current salary as-of date | tests/unit/current-salary.test.ts | tests/integration/current-salary.test.ts, tests/integration/rendered-profile.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | past/current/future/equal date |
| SAL-008 scheduled label | tests/unit/current-salary.test.ts | tests/integration/current-salary.test.ts, tests/integration/rendered-profile.test.ts | — | planned (Phase 6) | future revision never shown as current; the scheduled block is labelled and separate |
| SAL-010 salary + audit atomicity | — | planned (Phase 4) | — | planned (Phase 4) | forced audit failure rollback |
| SAL-011 stale update conflict | tests/unit/salary-rules.test.ts | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | two editor simulation |
| ANA-003 median | tests/unit/analytics.test.ts | planned (Phase 5) | — | — | empty/one/odd/even |
| ANA-004 empty not zero | tests/unit/analytics.test.ts | planned (Phase 5) | tests/component/product.test.tsx | planned (Phase 5) | empty aggregate → empty state |
| ANA-007 server-side query | — | tests/integration/employee-directory.test.ts, tests/integration/seeded-directory.test.ts, tests/integration/rendered-directory.test.ts | — | planned (Phase 6) | 10k rows never in browser; the rendered page links 25 profiles |
| ACC-001 no auth layer | — | — | tests/component/shell.test.tsx | planned (Phase 6) | no login route; no session cookie |
| ACC-002 assessment notice | — | — | tests/component/shell.test.tsx | planned (Phase 6) | visible on every page |
| ACC-003 actor surrogate | tests/unit/actor.test.ts | planned (Phase 4) | — | — | audit actor = `hr-manager` |
| RPT-001 reporting date default | tests/unit/date-only.test.ts, tests/unit/employee-directory-schema.test.ts, tests/unit/url-state.test.ts | tests/integration/current-salary.test.ts | tests/component/directory.test.tsx | — | defaults to today; a malformed or future date is ignored |
| RPT-003 URL-carried state | tests/unit/employee-directory-schema.test.ts, tests/unit/url-state.test.ts | tests/integration/rendered-directory.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | filters + asOf survive refresh/back |
| RPT-004 date-only, no TZ shift | tests/unit/date-only.test.ts, tests/unit/date-parsers.test.ts | tests/integration/date-parsers.test.ts | — | — | same calendar day in any locale; six timezones (D-021) |
| RPT-006 display rounding | tests/unit/money.test.ts | — | tests/component/product.test.tsx | — | DB value remains source of truth |
| RPT-007 no mixed-currency total | tests/unit/money.test.ts, tests/unit/analytics.test.ts | — | tests/component/product.test.tsx | planned (Phase 6) | every total single-currency or labelled |
| ELG-001 terminated not revisable | tests/unit/salary-rules.test.ts | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | `SALARY_NOT_ELIGIBLE` |
| ELG-002/003 date window | tests/unit/salary-rules.test.ts | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | before hire / after termination |
| ELG-004 currency fixed | tests/unit/salary-rules.test.ts | planned (Phase 4) | — | — | submitted currency cannot change policy |
| ELG-005 no revision surface | — | — | planned (Phase 4) | planned (Phase 6) | absent for terminated employees; the revision surface arrives in Phase 4 |
| ELG-006 terminated history visible | tests/unit/employment.test.ts | tests/integration/current-salary.test.ts, tests/integration/rendered-profile.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | labelled as-of termination: the card says "Final salary" and "Effective as of termination" |
| CON-001 version conflict | tests/unit/salary-rules.test.ts | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | stale write rejected, nothing written |
| CON-002 conflict preserves input | — | — | planned (Phase 4) | planned (Phase 4) | user can re-apply after refresh |
| CON-003 version increments | — | planned (Phase 4) | — | — | increments on success only |
| QRY-001 search fields | tests/unit/query-params.test.ts | tests/integration/employee-directory.test.ts, tests/integration/seeded-directory.test.ts | — | planned (Phase 6) | ID/name/email |
| QRY-002 literal wildcards | tests/unit/query-params.test.ts | tests/integration/employee-directory.test.ts | — | planned (Phase 6) | `%`, `_`, `'`, `\` are literal |
| QRY-003 invalid filter ignored | tests/unit/employee-directory-schema.test.ts, tests/unit/compensation-analytics-schema.test.ts | tests/integration/employee-directory.test.ts | — | — | falls back to default, no error |
| QRY-004 page bounds | tests/unit/query-params.test.ts | tests/integration/employee-directory.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | page beyond last → empty with a pager, not an error |
| QRY-005 sort allow-list | tests/unit/employee-directory-schema.test.ts, tests/unit/compensation-analytics-schema.test.ts | tests/integration/employee-directory.test.ts, tests/integration/seeded-directory.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | unknown sort → default; the salary sort uses the USD equivalent so six currencies are comparable (D-031) |
| QRY-006 filter resets page | tests/unit/url-state.test.ts | tests/integration/employee-directory.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | change filter → page 1 |
| QRY-007 empty distinction | — | tests/integration/employee-directory.test.ts, tests/integration/seeded-directory.test.ts | tests/component/product.test.tsx | planned (Phase 6) | no data vs no filter match |
| SEED-001 absence summary | tests/unit/seed-dataset.test.ts | tests/integration/seed.test.ts | tests/integration/rendered-profile.test.ts | — | no fabricated dated events |
| SEED-003 summary labelled | — | tests/integration/rendered-profile.test.ts | — | planned (Phase 6) | UI says "seed summary" |
| SEED-004 stable currency | tests/unit/seed-dataset.test.ts | tests/integration/seed.test.ts | — | — | 0 employees change currency (verified) |
| Employee directory | tests/unit/url-state.test.ts | tests/integration/employee-directory.test.ts, tests/integration/seeded-directory.test.ts, tests/integration/rendered-directory.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | filtering/sort/page bounds; the responsive priority is held by the row-details block |
| Employee profile | — | tests/integration/current-salary.test.ts, tests/integration/rendered-profile.test.ts | tests/component/directory.test.tsx | planned (Phase 6) | not-found/terminated/no support records |
| Salary revision flow | tests/unit/salary-rules.test.ts | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | pending/double-submit/conflict/success |
| Data quality | — | planned (Phase 5) | planned (Phase 5) | planned (Phase 5) | deterministic classification |
| Seed invariants | tests/unit/csv.test.ts, tests/unit/seed-dataset.test.ts | tests/integration/seed.test.ts | — | — | repeat run, orphan, duplicate; `pnpm db:verify` 29/29 |
| Health endpoint | — | planned (Phase 5) | — | planned (Phase 6) | DB unavailable + safe output |
| Error code catalogue | tests/unit/error-codes.test.ts | — | tests/component/error-state.test.tsx | planned (Phase 6) | every D-017 code maps to a UI recovery |

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
