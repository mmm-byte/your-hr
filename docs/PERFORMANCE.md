# Your HR — Performance Plan

## Goal
Demonstrate proportional engineering for 10,000 employees. Measure representative paths; do not claim internet-scale architecture.

## User-critical paths
1. Employee directory first page.
2. Employee search/filter/sort page.
3. Employee profile with current salary.
4. Salary history.
5. Salary revision transaction.
6. Key compensation analytics.

## Strategy
- Server-side filtering, sorting, pagination.
- Select only fields needed by the surface.
- Index employee foreign keys and proven filter/sort paths.
- Index salary `(employee_id, effective_from DESC)`.
- Avoid N+1 profile/list queries.
- Use database aggregates for compensation analytics instead of loading all employees into JavaScript.
- Cache only if measurement proves it necessary; do not introduce Redis by default.

## Measurement record
For each measured query record:
- dataset size
- environment (local/preview/production)
- query purpose/filters
- observed timing range (not one lucky number)
- query plan/index observation
- change made, if any

## Acceptance mindset
The directory should feel responsive under representative assessment traffic, but no invented millisecond SLA is declared before measurement. A simple indexed Postgres query is preferred over architectural complexity.

## Performance budgets (proposed — confirm against measurement)
These are **targets to measure against**, not claims. If a measurement exceeds a budget, either optimize
the query or record a documented exception with the reason. Never silently exceed them.

| Path | Budget | Why it matters |
|---|---|---|
| Directory first page (no filters) | ≤ 300 ms server time | The first impression of the product |
| Directory filtered + sorted page | ≤ 500 ms | The most common repeated action |
| Employee profile with current salary | ≤ 250 ms | A single-employee lookup should feel instant |
| Salary history (≤ 9 rows) | ≤ 200 ms | Small by construction |
| Salary revision transaction | ≤ 400 ms | Includes two inserts; must feel responsive |
| Key analytics aggregate | ≤ 800 ms | A cross-10,000-row aggregate, database-side |
| Server-side page size cap | ≤ 100 rows | Prevents an accidental 10,000-row response |

**A request that would exceed the page-size cap is clamped, never rejected** (QRY-004).

## What to do when a budget is missed
1. **Measure first** — capture the actual query plan with `EXPLAIN (ANALYZE, BUFFERS)`.
2. **Check for the usual causes** in order: missing index on the filter/sort column · a `SELECT *`
   projection pulling unneeded columns · an N+1 in the query layer · aggregation done in JavaScript
   instead of the database · a missing `LIMIT`.
3. **Add an index only with recorded justification** in this file, naming the query it serves and the
   plan change it produced.
4. **If it still does not meet the budget**, record the measured number and the accepted trade-off.
   Do not add caching infrastructure to hide a slow query.

## Performance edge cases
- high page number / broad unfiltered list
- wildcard-like search input
- low-selectivity country/status filters
- sorting by a joined/derived salary field
- analytics across all current employees
- employees with many salary/review/absence rows
- cold database/serverless start

## Known environment constraint (D-009, D-010)
The local development machine has **no PostgreSQL server available** (sandbox blocks shared-memory
allocation) and **~2 GB free disk**. This shapes two decisions already made:
- Integration performance measurements against PGlite are **not** representative of Neon. Performance
  numbers must be taken against Neon (or a real PostgreSQL server), and this file must record which
  environment produced each number.
- Playwright drives the installed system Chrome rather than downloading its own browser.

## Anti-patterns
- Fetch all 10,000 rows and paginate in React.
- N+1 salary lookup per employee table row.
- Compute median by pulling entire salary populations into the browser.
- Add caching infrastructure before measuring.
- Benchmark development mode and present it as production performance.
