---
applyTo: "**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx,tests/**/*"
---
# Your HR Test Instructions

Read `/AGENTS.md`, `/docs/TESTING.md`, `/docs/UX-JOURNEY.md`, `/docs/DECISIONS.md`, and `/tests/README.md` first.

## Coverage header
Each non-trivial test file states which rule IDs/behaviors it covers and which layer covers excluded concerns.

## Quality
- Test observable behavior, not private implementation details.
- Use fixed clocks, deterministic builders, isolated test state, and no live network/FX/production DB.
- Never weaken an assertion to accommodate generated code.
- Avoid broad snapshots for dynamic behavior.
- Test names describe business outcomes.

## Layers
| Layer | Directory | Database |
|---|---|---|
| Unit | `tests/unit/` | none |
| Integration | `tests/integration/` | PGlite (D-009) |
| Component | `tests/component/` | none (server actions mocked) |
| E2E | `tests/e2e/` | seeded environment |

Integration tests apply the same Drizzle-generated migration SQL that Neon receives, through
`drizzle-orm/pglite`. `drizzle-kit migrate` is not used against PGlite (it needs a `pg`-protocol driver).

## Scenario review
For each behavior consider happy path, boundary, invalid, empty/not-found, effective date/history, money/currency, concurrency/idempotency, transaction rollback, database constraint, UI states, accessibility, responsive risk, performance, and security. Mark non-applicable scenarios explicitly.

## The gaps this suite must not miss
These were undefined in the original specification and are now binding rules. A test must exist for each:

| Rule | Behavior |
|---|---|
| ACC-001 | No login route and no session cookie |
| ACC-002 | Assessment notice present on every page |
| ACC-003 | Audit actor is the fixed `hr-manager` surrogate |
| RPT-001 | Reporting date defaults to today |
| RPT-003 | Filters and reporting date survive refresh and back/forward |
| RPT-004 | A date-only value renders as the same calendar day in any locale |
| RPT-007 | No mixed-currency total is ever rendered |
| ELG-001 | A terminated employee cannot be revised (server-side, not just hidden) |
| ELG-004 | Currency cannot be changed by a revision |
| CON-001 | A stale expected version conflicts and writes nothing |
| CON-002 | A conflict preserves the user's submitted input |
| CON-003 | Version increments only on success |
| QRY-002 | `%`, `_`, `'`, `\` are literal in search, never SQL wildcards |
| QRY-003 | An unknown filter value falls back to a default instead of erroring |
| QRY-004 | A page beyond the last page returns empty, not an error |
| QRY-006 | Changing a filter resets pagination to page 1 |
| QRY-007 | "No data" and "no filter match" are distinct |
| SEED-001/003 | Absence and performance are labelled seed summaries, never fabricated dated events |
| D-017 | Every stable error code maps to its documented HTTP status and safe message |

## Matrix
Update `tests/TEST-MATRIX.md` with real test paths/status. No unexplained gap is allowed when declaring a feature complete.
