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
| MON-001 explicit currency | planned (Phase 2+) | planned (Phase 2) | tests/component/product.test.tsx | planned (Phase 2) | every money value carries a code |
| MON-004 multi-currency totals | tests/unit/money.test.ts | planned (Phase 2) | tests/component/product.test.tsx | planned (Phase 2) | grouped vs reporting equivalent |
| MON-002 exact decimal | tests/unit/money.test.ts | planned (Phase 2) | — | — | no float round-trip; string preserved |
| SAL-005 append-only revision | planned (Phase 2+) | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | old history unchanged |
| SAL-006 duplicate effective date | tests/unit/salary-rules.test.ts | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | conflict mapping → SALARY_EFFECTIVE_DATE_CONFLICT |
| SAL-007 current salary as-of date | tests/unit/current-salary.test.ts | planned (Phase 2) | — | planned (Phase 2) | past/current/future/equal date |
| SAL-008 scheduled label | tests/unit/current-salary.test.ts | planned (Phase 3) | planned (Phase 3) | planned (Phase 3) | future revision never shown as current |
| SAL-010 salary + audit atomicity | — | planned (Phase 4) | — | planned (Phase 4) | forced audit failure rollback |
| SAL-011 stale update conflict | planned (Phase 2+) | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | two editor simulation |
| ANA-003 median | planned (Phase 2+) | planned (Phase 2) | — | — | empty/one/odd/even |
| ANA-004 empty not zero | planned (Phase 2+) | planned (Phase 2) | planned (Phase 2) | planned (Phase 2) | empty aggregate → empty state |
| ANA-007 server-side query | — | planned (Phase 3) | — | planned (Phase 3) | 10k rows never in browser |
| ACC-001 no auth layer | planned (Phase 2+) | — | planned (Phase 3) | planned (Phase 3) | no login route; no session cookie |
| ACC-002 assessment notice | — | — | tests/component/shell.test.tsx | planned (Phase 3) | visible on every page |
| ACC-003 actor surrogate | planned (Phase 2+) | planned (Phase 2) | — | — | audit actor = `hr-manager` |
| RPT-001 reporting date default | tests/unit/date-only.test.ts | planned (Phase 2) | — | — | defaults to today |
| RPT-003 URL-carried state | planned (Phase 2+) | planned (Phase 3) | — | planned (Phase 3) | filters + asOf survive refresh/back |
| RPT-004 date-only, no TZ shift | tests/unit/date-only.test.ts, tests/unit/date-parsers.test.ts | tests/integration/date-parsers.test.ts | — | — | same calendar day in any locale; six timezones (D-021) |
| RPT-006 display rounding | tests/unit/money.test.ts | — | tests/component/product.test.tsx | — | DB value remains source of truth |
| RPT-007 no mixed-currency total | planned (Phase 2+) | planned (Phase 3) | planned (Phase 3) | planned (Phase 3) | every total single-currency or labelled |
| ELG-001 terminated not revisable | tests/unit/salary-rules.test.ts | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | `SALARY_NOT_ELIGIBLE` |
| ELG-002/003 date window | tests/unit/salary-rules.test.ts | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | before hire / after termination |
| ELG-004 currency fixed | tests/unit/salary-rules.test.ts | planned (Phase 4) | — | — | submitted currency cannot change policy |
| ELG-005 no revision surface | — | — | planned (Phase 3) | planned (Phase 3) | absent for terminated employees |
| ELG-006 terminated history visible | planned (Phase 2+) | planned (Phase 3) | planned (Phase 3) | planned (Phase 3) | labelled as-of termination |
| CON-001 version conflict | tests/unit/salary-rules.test.ts | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | stale write rejected, nothing written |
| CON-002 conflict preserves input | — | — | planned (Phase 4) | planned (Phase 4) | user can re-apply after refresh |
| CON-003 version increments | — | planned (Phase 4) | — | — | increments on success only |
| QRY-001 search fields | planned (Phase 2+) | planned (Phase 3) | — | planned (Phase 3) | ID/name/email |
| QRY-002 literal wildcards | planned (Phase 2+) | planned (Phase 3) | — | planned (Phase 3) | `%`, `_`, `'`, `\` are literal |
| QRY-003 invalid filter ignored | planned (Phase 2+) | planned (Phase 3) | — | — | falls back to default, no error |
| QRY-004 page bounds | planned (Phase 2+) | planned (Phase 3) | — | planned (Phase 3) | page beyond last → empty, not error |
| QRY-005 sort allow-list | planned (Phase 2+) | planned (Phase 3) | — | planned (Phase 3) | unknown sort → default |
| QRY-006 filter resets page | — | planned (Phase 3) | — | planned (Phase 3) | change filter → page 1 |
| QRY-007 empty distinction | planned (Phase 2+) | planned (Phase 3) | tests/component/product.test.tsx | planned (Phase 3) | no data vs no filter match |
| SEED-001 absence summary | tests/unit/seed-dataset.test.ts | tests/integration/seed.test.ts | planned (Phase 3) | — | no fabricated dated events |
| SEED-003 summary labelled | — | — | planned (Phase 3) | — | UI says "seed summary" |
| SEED-004 stable currency | tests/unit/seed-dataset.test.ts | tests/integration/seed.test.ts | — | — | 0 employees change currency (verified) |
| Employee directory | — | planned (Phase 3) | planned (Phase 3) | planned (Phase 3) | filtering/sort/page bounds |
| Employee profile | — | planned (Phase 3) | planned (Phase 3) | planned (Phase 3) | not-found/terminated/no support records |
| Salary revision flow | planned (Phase 2+) | planned (Phase 4) | planned (Phase 4) | planned (Phase 4) | pending/double-submit/conflict/success |
| Data quality | planned (Phase 2+) | planned (Phase 5) | planned (Phase 5) | planned (Phase 5) | deterministic classification |
| Seed invariants | tests/unit/csv.test.ts, tests/unit/seed-dataset.test.ts | tests/integration/seed.test.ts | — | — | repeat run, orphan, duplicate; `pnpm db:verify` 29/29 |
| Health endpoint | — | planned (Phase 3) | — | planned (Phase 3) | DB unavailable + safe output |
| Error code catalogue | tests/unit/error-codes.test.ts | planned (Phase 2) | planned (Phase 2) | — | every D-017 code maps to a UI recovery |

## Phase 1 coverage (complete 2026-11-13)
The data layer is covered end to end. `pnpm db:verify` asserts 29 invariants against a
real PostgreSQL instance and exits non-zero on any violation; `tests/integration/schema.test.ts`
covers the database constraints; `tests/integration/seed.test.ts` covers the seeded cohort;
and `tests/integration/date-parsers.test.ts` covers the timezone-safe date decoding that
D-021 introduced. A cell still marked `planned (Phase N)` belongs to a later phase and is
not a gap in Phase 1.

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
