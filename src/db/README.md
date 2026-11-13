# `src/db` — PostgreSQL and Drizzle

## Owns
- connection creation
- Drizzle schema
- migrations configuration
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

## Relationship comment
Each non-trivial query documents callers, tables/indexes used, domain rules, and integration tests.

## Tests
PostgreSQL integration tests cover constraints, transactions, current-as-of-date, filters/aggregates, concurrency, and rollback. Never target production.
