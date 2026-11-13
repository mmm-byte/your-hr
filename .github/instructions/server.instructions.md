---
applyTo: "src/app/**/*.ts,src/app/**/*.tsx,src/server/**/*.ts,src/actions/**/*.ts,src/queries/**/*.ts"
---
# Your HR Server and Backend Instructions

Read `/AGENTS.md`, `/docs/DOMAIN-RULES.md`, `/docs/API-CONTRACT.md`, `/docs/UX-JOURNEY.md`, `/docs/SECURITY.md`, and the nearest folder `README.md` first.

## Role
The backend is part of the same Next.js application. Do not create a separate server or duplicate internal operations behind unnecessary HTTP routes.

## Direction
Route/server component/server action -> focused application operation or query -> domain rule -> Drizzle/PostgreSQL.

## Rules
- Keep database access server-only.
- Validate all untrusted inputs at the server boundary with Zod.
- Parsing/schema validation does not replace domain validation requiring history/database context.
- Authoritative rules live in focused server/domain functions, not UI components or route handlers.
- Map database errors to stable safe application errors; never expose SQL, stack traces, connection details, or secret values.
- Use transactions for salary revision + audit and any multi-write invariant.
- Enforce optimistic concurrency for stale salary mutations.
- Do not log entire request payloads, employee records, or salary histories.
- Add correlation IDs for unexpected failures when useful.
- Do not call live FX services or fabricate missing data at runtime.

## Database driver (D-015 — verified)
Use `drizzle-orm/neon-serverless` with `@neondatabase/serverless`'s `Pool` (WebSocket transport).
**Do not use `drizzle-orm/neon-http`** — verified in the installed adapter source, it throws
`No transactions support in neon-http driver` for `db.transaction()`, which would make SAL-010
(salary + audit atomicity) impossible. Ensure `ws` is available in the serverless runtime.

## Error handling (D-017)
Every failure returns a code from the stable catalogue in `docs/DECISIONS.md` D-017 —
never free text. The UI maps the same code to a specific recovery action.
Unknown codes fall back to a generic safe message with a correlation ID.

## Actor identity (D-011, ACC-003)
There is no authenticated principal. Audit events use the fixed surrogate `hr-manager` from the
shared actor module. Never inline a different actor string at a call site, and never fabricate a
per-session actor.

## Query behavior
- Allow-list sort/group/filter fields.
- Bound page size and validate page numbers.
- Use intentional projections; avoid selecting sensitive/unneeded columns.
- Avoid N+1 queries.
- Current salary is selected by effective date as of the reporting date.
- Currency-sensitive aggregates group by currency or use the documented reporting equivalent.
- **Search is literal** (QRY-002): `%`, `_`, `'`, `\` are escaped and matched as text, never as SQL wildcards.
- Unknown filter or sort values fall back to a documented default (QRY-003, QRY-005) — they never error.
- **Money is never a JS number** (MON-002). `numeric` arrives as a string; keep it a string, or use `BigInt` minor units for arithmetic.
- **Dates are date-only** (RPT-004). Store and transport `YYYY-MM-DD`; never construct a `Date` from a date-only value.

## Comments
Non-trivial operations document purpose, callers, reads/writes, rules, transaction behavior, and tests. Comments explain why and invariants, not syntax.

## Testing
- Unit tests for pure domain behavior.
- Integration tests for database queries, transactions, conflicts, constraints, and error mapping (PGlite — D-009).
- Force rollback failures to prove atomicity.
- Test not-found, invalid, boundary, stale, duplicate, future-effective, and unavailable-database behavior where applicable.
