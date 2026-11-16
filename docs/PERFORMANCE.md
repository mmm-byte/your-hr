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

## Measurement record (Phase 6, 2026-11-15)

**Command:** `pnpm db:benchmark` — the script measures each path seven times after
a discarded warm-up and reports the fastest, median, and slowest. A timing range, not
one lucky number.

**Dataset:** the approved 10,000-person cohort — 10,000 employees, 22,093 salary
records, 40 departments, 8 branches, 5,418 absence summaries, 10,000 reviews, 4,278
attrition events.

**Environment:** local **PGlite** (PostgreSQL compiled to WebAssembly, running
in-process) on the development machine. **This is not a production measurement.**
PGlite is slower than a real PostgreSQL server on I/O-bound work, so these numbers
are a conservative floor, not a prediction of production latency. The measurements
must be repeated against Neon before any production claim is made.

| Path | Budget | Fastest | **Median** | Slowest | Verdict |
|---|---|---|---|---|---|
| Directory first page (no filters) | 300 ms | 32.58 ms | **32.96 ms** | 33.42 ms | within budget |
| Directory filtered + sorted page | 500 ms | 8.38 ms | **8.56 ms** | 9.47 ms | within budget |
| Employee profile with current salary | 250 ms | 0.22 ms | **0.23 ms** | 0.31 ms | within budget |
| Salary history | 200 ms | 0.13 ms | **0.13 ms** | 0.15 ms | within budget |
| Key analytics aggregate (grouped by currency) | 800 ms | 24.57 ms | **24.95 ms** | 25.66 ms | within budget |
| Workforce count (overview) | 200 ms | 0.51 ms | **0.51 ms** | 0.54 ms | within budget |

All six paths are within their budget, with the largest at **11 %** of its budget.

### Query plans and index observations

The captured plans confirm the strategy in this document is the one the planner
actually chose.

- **The current-salary lookup is an index-only scan.**
  `Index Only Scan Backward using salary_records_employee_effective_unique` reads
  the greatest `effective_from` on or before the reporting date, once per employee,
  at `0.001 ms` per lookup. The correlated sub-query costs 20,000 index probes for
  10,000 employees and takes **7.6 ms** of the directory query's 55 ms — the
  dominant cost, and it is an index probe rather than a scan.
- **The filter path uses the filter indexes.** A filtered directory page runs
  `Bitmap Index Scan on employees_country_code_idx` and
  `Bitmap Index Scan on employees_employment_status_idx` combined by a `BitmapAnd`,
  which narrows 10,000 employees to 1,805 before the sort. The unfiltered page
  uses a `Seq Scan` on `employees` instead — correct, because a sequential scan of
  10,000 rows is cheaper than 10,000 index probes when every row is needed.
- **The salary history uses the descending index.**
  `Bitmap Index Scan on salary_records_employee_effective_desc_idx` returns the
  four rows in **0.014 ms**.
- **The aggregates are a single scan and a group-by.** The analytics aggregate
  scans 22,093 salary rows and groups them by currency in **30.7 ms**, in the
  database. It is not a scan in JavaScript over the workforce, which is what
  ANA-007 and the "aggregates computed in the database" rule require.
- **The workforce count is a single scan** in **1.7 ms** — the overview's total is
  cheap enough that it needs no cache.

### Changes made as a result of the measurement

**None.** Every path met its budget, so no index was added and no caching was
introduced. The rule in this document is explicit: *"Cache only if measurement proves
it necessary; do not introduce Redis by default."* The measurement did not prove it
necessary, so nothing was changed.

One observation is recorded for the future rather than acted on: the directory's
unfiltered first page is the slowest path at 33 ms, and 55 % of its time is the
20,000 index probes in the correlated current-salary sub-query. If the workforce
grew past roughly 100,000 employees, that sub-query would become the first thing to
replace — most likely with a window function over
`salary_records_employee_effective_desc_idx`, which would turn 20,000 probes into
one pass. **At 10,000 employees it is not worth the complexity**, and the rule in
this document is to measure before changing.


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
