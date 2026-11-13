---
applyTo: "src/db/**/*.ts,drizzle/**/*,drizzle.config.*,scripts/**/*seed*.ts,scripts/**/*verify*.ts"
---
# Your HR Database Instructions

Read `/AGENTS.md`, `/docs/DATABASE.md`, `/docs/DATASET.md`, `/docs/DOMAIN-RULES.md`, `/docs/SECURITY.md`, and `/docs/DECISIONS.md` first.

## Source of truth
Drizzle schema and committed migrations define database structure. Never rely on undocumented manual dashboard changes.

## Schema rules
- Primary/foreign keys reflect real relationships.
- Employee ID is stable.
- Unique employee + salary effective date.
- Salary uses exact numeric semantics and must be positive.
- Bonus and review ranges have constraints where practical.
- Termination date cannot precede hire date.
- Salary history is append-only through product workflows.
- Index foreign keys and measured filter/sort paths, including employee + effective date descending.
- Do not add speculative indexes; record measured justification in `docs/PERFORMANCE.md`.
- Money columns are `numeric` with explicit precision/scale. Base salary `numeric(12,2)` (max seeded value is 9,647,953.00 — verified), bonus `numeric(5,2)`. Dates are `date`, not `timestamptz` — a date-only value must not shift across time zones (RPT-004).
- The employee row carries a `version` column for optimistic concurrency (CON-001, CON-003).

## Runtime driver (D-015 — verified)
Use `drizzle-orm/neon-serverless` with `@neondatabase/serverless`'s `Pool` (WebSocket transport).
**Never `drizzle-orm/neon-http`** — its `db.transaction()` throws `No transactions support in neon-http driver`,
which would make the salary + audit atomic write (SAL-010) impossible.

## Test database (D-009 — verified)
Integration tests run against **PGlite** (`@electric-sql/pglite`) through `drizzle-orm/pglite`.
It is real PostgreSQL in WebAssembly: `CHECK` constraints, `UNIQUE` constraints, transactions with
rollback, and exact `numeric` behavior all hold (verified in this workspace).

Apply the **same Drizzle-generated migration SQL** the Neon database receives, through PGlite's
`exec()`. `drizzle-kit migrate` targets a `pg`-protocol driver and is not used against PGlite.
The committed migration files remain the single source of truth for both environments.

## Migrations
- Forward-safe and reviewed.
- Apply to development first.
- Destructive changes require an explicit migration/data plan and human review.
- Migration failure blocks seed/release.
- Do not auto-run destructive migrations against production from tests.

## Seed/import
- Exactly 10,000 approved employees and related records.
- Deterministic; idempotent or safely refuses rerun.
- Reject/report orphan relationships and duplicate salary effective dates.
- Preserve source/localization provenance.
- Do not silently invent runtime values.
- Never seed automatically on every build or application startup.
- Verification returns non-zero on invariant failure and prints no secrets.
- **Absence and performance carry summary semantics only** (D-018, D-019): absence is a record count plus total days, performance is the latest review. Do not synthesize dated absence or review events. A blank absence summary means *no absence records*, which is distinct from *zero days across N records*.
- Seeded data facts verified in this workspace: 10,000 unique employees · 22,093 salary rows · every employee has ≥1 salary · 0 duplicate `(employee_id, effective_from)` · 0 salary before hire · 0 salary after termination · 0 currency/country mismatches · 0 orphans · bonus 0–40% · currency never changes for an employee · 4,582 employees have no absence records.

## Transactions/concurrency
- Salary + audit writes are atomic, in one transaction.
- Stale updates conflict instead of overwriting (SAL-011, CON-001).
- The employee `version` increments on every successful salary revision (CON-003).
- Integration tests must prove rollback and unique constraints.

## Query comments/tests
Non-trivial queries document callers, tables/indexes, rules, and integration tests. Test PostgreSQL behavior against PGlite (never production).
