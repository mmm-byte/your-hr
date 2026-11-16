# `src/db` — PostgreSQL and Drizzle

## Owns
- connection creation
- Drizzle schema
- migrations configuration
- driver type parsers
- focused queries/repositories
- transaction helpers

## Does not own
- UI formatting
- HTTP concerns
- duplicated domain decisions

## Rules
- Server-only.
- Schema + migrations are source of truth.
- Exact money semantics.
- Parameterized access only.
- Focused projections and measured indexes.
- Salary + audit writes are transactional.
- `date` columns are decoded by the shared parser in `date-parsers.ts` (D-021).
  The application pool, the operational scripts, and the PGlite test database
  must all use it, so the tests exercise the representation production receives.

## Relationship comment
Each non-trivial query documents callers, tables/indexes used, domain rules, and integration tests.

## Modules
- `schema.ts` — the Drizzle schema. The `pgEnum` types are derived from `src/lib/domain-values.ts` (D-024).
- `client.ts` — the database handle. A Neon Pool, or a local PGlite instance when `PGLITE_PATH` is set (D-027).
- `date-parsers.ts` — the `date` column parser shared by the pool, the scripts, and the tests (D-021).
- `queries/employees.ts` — the directory query: search, filters, allow-listed sort, and pagination (QRY-001…007, ANA-007).
- `queries/current-salary.ts` — the profile query: identity, current salary as of a date, salary history, and the supporting summaries (SAL-007, ELG-006).
- `queries/salary-revision.ts` — the revision write: the context the form needs, and the transactional write that appends a salary row and its audit event together (SAL-010, SAL-011, ELG-001, AUD-001).

### The revision write
The write is guarded by a **conditional update** — `UPDATE employees SET version = version + 1
WHERE id = ? AND version = ?` — and the affected-row count decides the outcome. A read-then-write
check would let two concurrent writers both pass, so the check and the write are one statement
inside one transaction (D-033). The eligibility gate is enforced **inside** that transaction
as well, because a rule that is checked only in the domain layer can be defeated by the layer
that owns the write (D-034). The module is generic over the query-result kind, so the same code
runs against Neon and against PGlite.

## Tests
PostgreSQL integration tests cover constraints, transactions, current-as-of-date, filters/aggregates, concurrency, and rollback. Never target production.

The integration tests run against PGlite, seeded with the real cohort by
`tests/fixtures/seeded-database.ts`. The seed is deterministic, so the same
rows are produced on every run.
