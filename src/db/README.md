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

## Tests
PostgreSQL integration tests cover constraints, transactions, current-as-of-date, filters/aggregates, concurrency, and rollback. Never target production.

The integration tests run against PGlite, seeded with the real cohort by
`tests/fixtures/seeded-database.ts`. The seed is deterministic, so the same
rows are produced on every run.
