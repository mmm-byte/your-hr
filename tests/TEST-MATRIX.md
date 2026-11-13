# Your HR Test Matrix

Update this file as implementation paths become real. A blank cell requires an explicit reason.

Rule groups: `EMP` employee · `MON` money/currency · `SAL` salary history · `ABS` absence ·
`PERF` performance · `ATT` attrition · `ANA` analytics · `AUD` audit · `ACC` access ·
`RPT` reporting/display · `ELG` revision eligibility · `CON` concurrency · `QRY` search/filter ·
`SEED` seed assumptions.

| Capability / rule | Unit | Integration | Component | E2E | Edge cases / notes |
|---|---|---|---|---|---|
| EMP-001 unique employee ID | — | planned | — | — | DB constraint + seed verify |
| EMP-004 termination >= hire | planned | planned | — | — | boundary equal dates |
| MON-001 explicit currency | planned | planned | planned | planned | every money value carries a code |
| MON-004 multi-currency totals | planned | planned | planned | planned | grouped vs reporting equivalent |
| MON-002 exact decimal | planned | planned | — | — | no float round-trip; string preserved |
| SAL-005 append-only revision | planned | planned | planned | planned | old history unchanged |
| SAL-006 duplicate effective date | planned | planned | planned | planned | conflict mapping → SALARY_EFFECTIVE_DATE_CONFLICT |
| SAL-007 current salary as-of date | planned | planned | — | planned | past/current/future/equal date |
| SAL-008 scheduled label | planned | planned | planned | planned | future revision never shown as current |
| SAL-010 salary + audit atomicity | — | planned | — | planned | forced audit failure rollback |
| SAL-011 stale update conflict | planned | planned | planned | planned | two editor simulation |
| ANA-003 median | planned | planned | — | — | empty/one/odd/even |
| ANA-004 empty not zero | planned | planned | planned | planned | empty aggregate → empty state |
| ANA-007 server-side query | — | planned | — | planned | 10k rows never in browser |
| ACC-001 no auth layer | planned | — | planned | planned | no login route; no session cookie |
| ACC-002 assessment notice | — | — | planned | planned | visible on every page |
| ACC-003 actor surrogate | planned | planned | — | — | audit actor = `hr-manager` |
| RPT-001 reporting date default | planned | planned | — | — | defaults to today |
| RPT-003 URL-carried state | planned | planned | — | planned | filters + asOf survive refresh/back |
| RPT-004 date-only, no TZ shift | planned | planned | — | — | same calendar day in any locale |
| RPT-006 display rounding | planned | — | planned | — | DB value remains source of truth |
| RPT-007 no mixed-currency total | planned | planned | planned | planned | every total single-currency or labelled |
| ELG-001 terminated not revisable | planned | planned | planned | planned | `SALARY_NOT_ELIGIBLE` |
| ELG-002/003 date window | planned | planned | planned | planned | before hire / after termination |
| ELG-004 currency fixed | planned | planned | — | — | submitted currency cannot change policy |
| ELG-005 no revision surface | — | — | planned | planned | absent for terminated employees |
| ELG-006 terminated history visible | planned | planned | planned | planned | labelled as-of termination |
| CON-001 version conflict | planned | planned | planned | planned | stale write rejected, nothing written |
| CON-002 conflict preserves input | — | — | planned | planned | user can re-apply after refresh |
| CON-003 version increments | — | planned | — | — | increments on success only |
| QRY-001 search fields | planned | planned | — | planned | ID/name/email |
| QRY-002 literal wildcards | planned | planned | — | planned | `%`, `_`, `'`, `\` are literal |
| QRY-003 invalid filter ignored | planned | planned | — | — | falls back to default, no error |
| QRY-004 page bounds | planned | planned | — | planned | page beyond last → empty, not error |
| QRY-005 sort allow-list | planned | planned | — | planned | unknown sort → default |
| QRY-006 filter resets page | — | planned | — | planned | change filter → page 1 |
| QRY-007 empty distinction | planned | planned | planned | planned | no data vs no filter match |
| SEED-001 absence summary | planned | planned | planned | — | no fabricated dated events |
| SEED-003 summary labelled | — | — | planned | — | UI says "seed summary" |
| SEED-004 stable currency | planned | planned | — | — | 0 employees change currency (verified) |
| Employee directory | — | planned | planned | planned | filtering/sort/page bounds |
| Employee profile | — | planned | planned | planned | not-found/terminated/no support records |
| Salary revision flow | planned | planned | planned | planned | pending/double-submit/conflict/success |
| Data quality | planned | planned | planned | planned | deterministic classification |
| Seed invariants | planned | planned | — | — | repeat run, orphan, duplicate |
| Health endpoint | — | planned | — | planned | DB unavailable + safe output |
| Error code catalogue | planned | planned | planned | — | every D-017 code maps to a UI recovery |

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
