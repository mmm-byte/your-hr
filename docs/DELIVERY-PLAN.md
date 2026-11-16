# Your HR — Delivery Plan (Base to Top)

**Purpose:** the build order, the gate each phase must pass, and the exact commands that prove it.
**Status:** Phase 0 complete (2026-11-12) · Phase 1 complete (2026-11-13) · Phase 2 next — domain core.
**Owner:** engineer. AI proposes and implements; every claim below is verified by a command, not by assertion.

This plan sequences work bottom-up so that every later phase inherits something already proven.
Each phase ends at a **green gate**: one command set that must be clean before the next phase starts.
A phase that cannot pass its gate is not "mostly done" — it is not done.

> **Reading the file paths in this document:** every `src/...` path named here is a file a phase will
> **create**. They are listed up front so the shape of the codebase is agreed before it is written.
> A path that does not exist yet is expected, not a broken reference.

---

## 0. Verified environment facts

Everything below was executed in this workspace, not assumed. Re-verify with the probes in `docs/ENVIRONMENT.md`.

| Fact | Verified result | Consequence |
|---|---|---|
| Node | `v22.23.2` | Meets Next.js 16 requirement |
| pnpm | `9.15.0` works | Use pnpm; `npm` is **broken** here (`Cannot find module 'graceful-fs'`) |
| npm | broken | Never call `npm`; use `pnpm` |
| Next.js | `16.4.6` scaffolds, installs, **and builds successfully** | Build works here |
| React / TS | `19.3.1` / `5.9.3` | Vitest 5 wants `@types/node >=22` — pin `@types/node@^22` |
| Tailwind | `4.3.5` | Use the v4 `@tailwindcss/postcss` plugin path |
| Drizzle | `drizzle-orm 0.45.4` + `drizzle-kit 0.31.11` | `drizzle-kit generate` verified working |
| Zod | `4.6.7` | Zod 4 API |
| Neon | `@neondatabase/serverless` + `drizzle-orm/neon-serverless` both import cleanly | Production path is sound |
| Vitest | `5.1.0` runs and passes | Unit/component testing works |
| Playwright | `1.65.0` installs; **browser download fails (ENOSPC)** | See blocker B2 |
| System Chrome | `Google Chrome 157.0.8103.78` present at `/Applications/Google Chrome.app` | Use `channel: 'chrome'` — no browser download |
| Local Postgres | **cannot start** — `shmget ... Operation not permitted` | See blocker B1 |
| **PGlite** | `@electric-sql/pglite 0.5.16` **works**: real Postgres in WASM | **This is the integration-test engine** |
| Drizzle + PGlite | `drizzle-orm/pglite` adapter exists and is first-class | Drizzle can run against PGlite unchanged |
| Disk | **~1.9 GB free** of 228 GB (99–100% full) | See blocker B3 |
| Registry | `registry.npmjs.org` returns 200 | Network is fine |

### Proof of the integration-test path (executed, not theorized)

A throwaway script using `drizzle-orm/pglite` against real PostgreSQL semantics confirmed all five
domain invariants the product depends on:

```
1. insert + select OK, numeric arrives as string '50000.00'  (no float drift)
2. exact numeric preserved: 50000.00 | 123456789.12
3. CHECK (salary > 0) enforced                    -> SAL-002
4. UNIQUE (employee_id, effective_from) enforced  -> SAL-006
5. forced mid-transaction failure rolled back; rows after = 1 -> SAL-010 ATOMIC
6. as-of-date query returned the correct row       -> SAL-007
```

This is the single most important finding in this plan: **the test suite does not need a database server.**

---

## 1. Blockers and their resolutions

### B1 — Local PostgreSQL cannot start (sandbox restriction)
`initdb` fails at bootstrap with `could not create shared memory segment: Operation not permitted`.
`pg_ctl` on the existing Homebrew cluster fails with `pre-existing shared memory block ... still in use`.
System V `shmget` works from plain Python, so this is PostgreSQL's specific shm allocation path being blocked.

**Resolution:** do not fight it. Use **PGlite** for all local and CI integration tests.
It is real PostgreSQL compiled to WASM — same SQL, same constraint enforcement, same transactions.
The application still targets **Neon/PostgreSQL**; only the *test harness* uses PGlite.

| Concern | Answer |
|---|---|
| Is PGlite real Postgres? | Yes — upstream PostgreSQL, WASM build. Constraints, transactions, and SQL semantics are genuine. |
| Is the schema identical to Neon? | Yes, if migrations are applied through the same Drizzle SQL. |
| Does `drizzle-kit migrate` work against PGlite? | It needs a `pg`-protocol driver. Apply the **same generated SQL** through PGlite's `exec()` instead — the migration files stay the single source of truth. |
| Does Neon still get used? | Yes — Neon is the runtime database. PGlite is only the test engine. |

**Fallback if PGlite ever proves insufficient:** enable Docker Desktop on the user's own machine
(the Docker socket is sandbox-blocked here, but `Docker.app` is installed and the user runs it unsandboxed).

### B2 — Playwright browser download fails (disk full)
`playwright install chromium` fails with `ENOSPC: no space left on device`.

**Resolution:** use `channel: 'chrome'` — Playwright drives the already-installed system Google Chrome
and downloads nothing. Config must be named **`playwright.config.ts`** (verified: `pw.config.ts` is silently ignored).

> **Note on my sandbox:** launching Chrome from my agent session fails on a macOS Mach-port restriction
> (`bootstrap_check_in ... Permission denied (1100)`). That is a sandbox limitation on *my* side, not a
> defect in the project. E2E will run on the user's machine / CI, where it works.

### B3 — Disk is nearly full (1.9 GB free)
`/System/Volumes/Data` is at 99–100% capacity. A full `node_modules` + Next build + Playwright browsers
can exceed this and cause confusing failures mid-build.

**Resolution:** free space before Phase 0, and keep the project lean:
- Remove the redundant backup at `/Users/mahindragupthakotha/SalaryLens` once the restore is confirmed (6.4 MB — small, but it is a duplicate).
- Set `pnpm store prune` to reclaim the pnpm content-addressable store.
- Configure Playwright to use system Chrome (no browser download) — saves ~500 MB.
- Add `node_modules`, `.next`, `test-results`, `playwright-report` to `.gitignore`; never commit build output.
- Target a project footprint under ~800 MB.

### B4 — Sandbox write restrictions
`~/.cache`, `~/Library/Caches`, `~/Library/Preferences` are not writable from my session.

**Resolution:** for any tool that needs them, run with:
```bash
HOME="$TMPDIR/fakehome" npm_config_cache="$TMPDIR/npm-cache" \
  npm_config_cache_dir="$TMPDIR/pnpm-cache-dir" pnpm <command>
```
Verified working for `create-next-app`, `pnpm install`, `pnpm build`, `vitest`, `drizzle-kit generate`, and `playwright test`.

---

## 2. The phase ladder

Each phase is a **vertical slice that is independently runnable**, never "all the code, then all the tests".
Every phase follows the same five-beat rhythm: **read → red test → minimal implementation → green → commit.**

### Phase 0 — Repository & toolchain foundation
**Goal:** an empty product that reliably installs, builds, lints, typechecks, and runs in CI.

| # | Work | Files |
|---|---|---|
| 0.1 | `git init`, first commit = current docs (truthful history start) | — |
| 0.2 | `.gitignore`, `.env.example` (placeholders only), root `README.md` | `.gitignore`, `.env.example`, `README.md` |
| 0.3 | `package.json` named `your-hr`, `packageManager: pnpm@9.15.0` | `package.json` |
| 0.4 | Scaffold Next.js 16 + TS strict + Tailwind 4 + ESLint 9 into existing tree (do **not** re-run CNA over it — it would clobber `docs/`) | `src/app/**`, `next.config.ts`, `tsconfig.json` |
| 0.5 | Install Drizzle, Zod, Vitest, Testing Library, Playwright, PGlite | `package.json` |
| 0.6 | Wire **all ten** required scripts (see §3) | `package.json` |
| 0.7 | CI workflow: lint → typecheck → test → build | `.github/workflows/ci.yml` |
| 0.8 | `GET /api/health` returning safe status only | `src/app/api/health/route.ts` |
| 0.9 | **Global shell**: sidebar nav with 5 items, `aria-current`, skip link, assessment notice (ACC-002), root `not-found.tsx` | `src/app/layout.tsx`, `src/app/not-found.tsx` |
| 0.10 | **Neon driver selection**: `drizzle-orm/neon-serverless` + `ws` — **not** `neon-http` (D-015). `neon-http` throws on `db.transaction()`, which would break SAL-010. | `src/db/client.ts` |
| 0.11 | **Error catalogue module**: the 10 stable codes from D-017, shared by API and UI | `src/lib/error-codes.ts` |
| 0.12 | **Actor surrogate**: one shared constant `hr-manager` (D-011, ACC-003) | `src/lib/actor.ts` |

**Gate 0:** `pnpm install && pnpm lint && pnpm typecheck && pnpm build && pnpm test` all green, and CI runs it.
A smoke check confirms the shell renders with nav, notice, and a 404 page.

> **Zero-DB constraint:** Phases 0–1 must build and test with **no database at all**. That keeps every early
> commit provably correct and makes the CI pipeline work before Neon exists.

---

### Phase 1 — Schema, migrations, deterministic seed ✅
**Goal:** the 10,000-person cohort exists, verified, and reproducible.

| # | Work | Rules |
|---|---|---|
| 1.1 | Drizzle schema: `departments`, `branches`, `employees`, `salary_records`, `absence_records`, `performance_reviews`, `attrition_events`, `audit_events` | [DATABASE.md](DATABASE.md) |
| 1.2 | Constraints: unique email, unique `(employee_id, effective_from)`, `CHECK salary > 0`, `CHECK 0 ≤ bonus_pct ≤ 100`, `CHECK termination_date ≥ hire_date` | EMP-002, SAL-002/003/006, EMP-004 |
| 1.3 | Indexes: `salary_records(employee_id, effective_from DESC)`, FK indexes on filter columns | ANA-007 |
| 1.4 | Exact money: `numeric(12,2)` for local salary, `numeric(12,2)` for USD equivalent, `numeric(5,2)` for bonus | MON-002 |
| 1.5 | `drizzle-kit generate` → committed migrations | — |
| 1.6 | Seed script: CSV → DB, **deterministic**, idempotent-or-refuse, chunked inserts, resumable | DATASET.md |
| 1.7 | `db:verify`: counts, uniqueness, FK orphans, date ranges, currency alignment, duplicate effective dates | scripts/README.md |
| 1.8 | Integration tests run against **PGlite** with the same generated SQL | SAL-002/006/010, EMP-004 |

**Seed facts already verified in this workspace** (so the seed can be trusted):

| Check | Result |
|---|---|
| Employees / unique IDs | 10,000 / 10,000 ✅ |
| Salary rows | 22,093, every employee has ≥1 ✅ |
| Duplicate `(employee_id, effective_from)` | 0 ✅ |
| Salary effective before hire | 0 ✅ |
| Salary effective after termination | 0 ✅ |
| Currency vs country mismatch | 0 ✅ |
| Orphan salary rows | 0 ✅ |
| Bonus % out of 0–100 | 0 ✅ (range 0–40) |
| Currency changes across an employee's revisions | **0** — currency is stable per employee, so `SAL-006` plus a currency guard is safe |
| Master `current_base_salary_local` vs latest salary row | matches for all 10,000 ✅ |
| Max localized salary | 9,647,953.00 → `numeric(12,2)` has headroom ✅ |
| Decimal places | 1 or 2 ✅ |
| `effective_from` range | 2015-01-17 → 2026-09-29 ✅ |

> **⚠️ One honest gap to resolve in Phase 1.** The master CSV carries absence data only as
> **aggregates** (`absence_record_count`, `total_absence_days`) and performance data only as a
> **latest snapshot** (`latest_review_date/rating/goals_met_pct`). There are **no per-row absence or
> review tables** in the supplied files.
> **Decision:** do not fabricate dated absence or review rows that never existed. Seed the
> `absence_records` / `performance_reviews` tables only with what the source actually contains
> (one snapshot row per employee, explicitly marked as a snapshot), and have the profile display a
> truthful **summary** ("12 absence days across 3 records", "latest review: 4/5") rather than invented
> dated history. Record this explicitly in `docs/DATASET.md` and `docs/DECISIONS.md` as a synthetic
> modeling assumption, and make the UI label it as a summary so no one mistakes it for event history.

**Gate 1:** `pnpm db:generate && pnpm db:migrate && pnpm db:seed && pnpm db:verify` green on PGlite;
seed run twice is safe; `db:verify` exits non-zero on any injected violation.

**Gate 1 — passed 2026-11-13.** `pnpm db:generate` reports no schema drift;
`pnpm db:migrate` applies `0000_sloppy_frog_thor.sql` and skips it on a second run;
`pnpm db:seed` writes 10,000 employees, 22,093 salary rows, 5,418 absence summaries,
10,000 reviews, and 4,278 attrition events, and refuses a second run with
*"The target already contains 10000 employees."*; `pnpm db:verify` reports **29/29**
checks passed. The gate was proven by injection: moving one salary record to a day
before its employee's hire date turned the run to **28/29 with exit code 1**.

Alongside the gate: `pnpm lint`, `pnpm typecheck`, `pnpm test` (11 files, 154 tests),
`pnpm test:integration` (3 files, 38 tests), and `pnpm build` are all green.

> **One defect found and fixed during the gate.** The seed's SAL-007 assertion failed
> because a `date` column read back as the **previous** calendar day. Neon's parser builds
> a `Date` at *local* midnight and Drizzle re-slices it in UTC, so any deployment east
> of UTC would have lost a day on every reported date — invisible in the tests, because
> PGlite decodes `date` as UTC midnight and was already correct. Fixed by a custom type
> parser for OID 1082 that returns the raw `YYYY-MM-DD` text (D-021), applied to the
> application pool, the scripts, and the test database alike. A regression test runs a
> probe under six timezones and fails if the configuration is removed.

---

### Phase 2 — Domain core (pure, no I/O)
**Goal:** every business rule exists as a **pure, fast, deterministic** function with tests — before any UI.

| Module | Rules | Tests |
|---|---|---|
| `src/lib/money.ts` | MON-001…006, RPT-005, RPT-006 — exact decimal handling, central formatter, no manual symbol concatenation, display rounding | unit |
| `src/lib/salary-rules.ts` | SAL-002…009, SAL-012, ELG-001…004 — revision validation and eligibility | unit |
| `src/lib/current-salary.ts` | SAL-007, SAL-008, RPT-001, RPT-004 — as-of-date selection, future-effective labelling, date-only semantics | unit |
| `src/lib/analytics.ts` | ANA-003 — median with correct even/odd handling; ANA-004 — empty ≠ zero | unit |
| `src/lib/employment.ts` | EMP-003…006 — hire/termination/status invariants | unit |
| `src/lib/date-only.ts` | RPT-004 — date-only parsing/formatting with no timezone drift | unit |
| `src/lib/error-codes.ts` | D-017 — the 10 stable codes and their user-facing recoveries | unit |
| `src/schemas/*.ts` | Zod boundaries — bounded page size, allow-listed sort/group, no silent coercion (QRY-003, QRY-005) | unit |

**Money representation decision:** Drizzle returns `numeric` as a **string** (verified: `'50000.00'`).
Keep money as strings in the domain layer and parse to `BigInt` minor units only where arithmetic is required.
Never let a salary become a JS `number`. This satisfies MON-002 without a decimal library.

**Date representation decision:** store and transport dates as `YYYY-MM-DD` strings, never `Date` objects
that carry a local timezone. A `new Date('2026-03-01')` parsed in one timezone and formatted in another
shifts the day — this is the RPT-004 bug, and it is avoided structurally by never constructing a `Date`
for a date-only value.

**Gate 2:** `pnpm test` green with ≥1 test per rule ID; no database required; runs in <5 s.
**Passed 2026-11-13** — 15 files, 214 tests, 0.4 s, no database. See §7 for the defects
found and fixed.

---

### Phase 3 — Employee directory & profile (first vertical slice)
**Goal:** a reviewer can find an employee and understand them.

| # | Work | Rules |
|---|---|---|
| 3.1 | `src/db/queries/employees.ts` — server-side search/filter/sort/pagination with allow-listed sorts and bounded page size | ANA-007, QRY-001…007 |
| 3.2 | `src/db/queries/current-salary.ts` — as-of-date query joining employees → salary_records | SAL-007, RPT-001 |
| 3.3 | `/employees` — FilterBar, DataTable, pagination, URL-persisted state, empty/no-match/error states | UI.md, UX-JOURNEY §3 |
| 3.4 | `/employees/[employeeId]` — identity, employment, current compensation, salary history, supporting context | EMP-009, SAL-001, ELG-006 |
| 3.5 | Product components: `MoneyDisplay`, `StatusBadge`, `EmployeeIdentity`, `CountryBranchLabel`, `EmptyState`, `ErrorState`, `LoadingSkeleton` | UI.md, RPT-005 |
| 3.6 | `loading.tsx`, `error.tsx`, and employee-scoped `not-found.tsx` | UX-JOURNEY §4.2 |
| 3.7 | Shared `ReportingDatePicker` used by every money surface | RPT-001, RPT-002 |
| 3.8 | Integration tests for query filters/sorts/page bounds; component tests for money + status rendering | QRY-*, RPT-* |

**Gate 3:** `pnpm test && pnpm build` green; `/employees` renders 10,000 records server-side with
verified pagination; profile shows the correct current salary for a past, present, and future reporting date.

**Gate 3 — passed 2026-11-13.** Evidence:

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (20 files, 298 tests), `pnpm test:integration`
  (8 files, 120 tests), `pnpm build` — all green. The CI run is green on every commit.
- The directory is rendered from the seeded 10,000-person cohort in PGlite.
  `tests/integration/rendered-directory.test.ts` asserts the page links 25 profiles, not
  10,000, so the browser never holds the workforce (ANA-007).
- `tests/integration/current-salary.test.ts` covers the current salary for a past, present,
  and future reporting date, and for a date exactly equal to an effective date (SAL-007).
- The profile and the directory were inspected in a browser against the real cohort: the
  reporting context, the identity grid, the salary history timeline, the not-found page, a
  terminated employee, the empty and no-match states, the 390px layout, the keyboard focus
  order, the dependent country-to-branch filter, and the rows-per-page selector.

Defects found and fixed during the gate — each is now covered by a test:

| Defect | Rule | Fix |
|---|---|---|
| `formatDateLong` produced `Mar 1, 2026` while every example in the product copy uses `12 Nov 2026` | RPT-004 | The parts are formatted individually and joined, giving `1 Mar 2026` |
| The profile repeated its own label: "Hired: Hired: 26 Feb 2026" | UI.md | `DateFact` carries no label; the `Fact` term is the label |
| Raw ISO dates in the review and attrition copy (`2026-03-24`) | RPT-004 | Every date surface goes through `formatDateLong` |
| The USD equivalent printed the currency twice: "$74,716.94 USD USD equivalent" | MON-005 | The amount is formatted without the code; the label names it |
| A terminated employee's card read "Current as of 13 Nov 2026" for someone who left in 2021 | ELG-006 | `salaryCardAsOf` states the termination date and the wording together |
| The location column was hidden below `md`, so a phone lost the location as well as the work mode | UI.md → Responsive priority | Location stays a column; the work mode moves into a row-details block |
| `?page=999` claimed "the workforce has not been loaded yet" | QRY-004 | The page states that it is past the end and keeps a pager |
| The pager printed "Page 999 of 400" and a range running past the total | QRY-004 | The range is dropped and the back link goes to the last page with results |
| The salary sort compared six currencies as one number, so "highest salary" was an artefact of the currency mix | MON-004, RPT-007 | The sort uses `usd_equivalent`, the basis every record shares, and the table states the basis (D-031) |
| A URL carrying a future reporting date put the date control into a state the browser reported as invalid | RPT-001 | The reporting date is bounded to the past and the present, in the schema and in both routes |
| The profile's "no salary record" message printed the raw ISO date | RPT-004 | Every date surface goes through `formatDateLong` |
| The Status filter offered "active" and "terminated" in raw snake_case beside badges that read "Active" and "Terminated" | UI.md | The display labels live in one shared map beside the values they label |
| The pager had no rows-per-page selector, which the journey requires | UX-JOURNEY §3 | The size is part of the URL state, and changing it returns to page 1 |
| The salary history stated no timestamp, which the journey requires | UX-JOURNEY §4 | Each record states when it was written, in UTC |
| PostgreSQL sorted the country enum by declaration order, not alphabetically | QRY-005 | Enum sort columns are cast to text |
| `applyQueryChange` ignored the `page` key, so a page change was never applied | QRY-004 | The key is handled like every other one |

---

### Phase 4 — Salary revision (the critical mutation)
**Goal:** the core write path is safe, auditable, and conflict-aware.

| # | Work | Rules |
|---|---|---|
| 4.1 | Server action + Zod validation, server authoritative | API-CONTRACT.md, QRY-003 |
| 4.2 | Transaction: insert `salary_records` **and** `audit_events` atomically — using the `neon-serverless` Pool driver (D-015) | SAL-010, AUD-001 |
| 4.3 | Optimistic concurrency: `expectedVersion` compared against the stored employee compensation version; increment on success | SAL-011, CON-001, CON-003 |
| 4.4 | Stable error codes from D-017 mapped to specific UI recoveries | D-017, API-CONTRACT.md |
| 4.5 | Eligibility gate: only `active`/`on_leave`; effective date within hire..termination; currency fixed | ELG-001…ELG-005 |
| 4.6 | Revision form at `/employees/[employeeId]/revise-salary`: current vs proposed, explicit currency, reason required, double-submit protection, pending/success/error/conflict states | SAL-009, UI.md, UX-JOURNEY §3 Step 6 |
| 4.7 | Conflict response preserves the user's input so it can be re-applied | CON-002 |
| 4.8 | Integration tests: forced audit failure rolls back (verified feasible), stale write conflicts, duplicate effective date conflicts, terminated-employee rejection | SAL-006, SAL-010, SAL-011, ELG-001 |

**Gate 4:** `pnpm test` green; a forced mid-transaction failure leaves **zero** salary rows written
(the exact scenario proven in §0); a stale revision returns a safe conflict, never a silent overwrite;
a terminated employee's revision is rejected server-side, not only hidden in the UI.

**Gate 4 — passed 2026-11-16.** Evidence:

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (21 files, 312 tests), `pnpm test:integration`
  (10 files, 146 tests), `pnpm build`, `pnpm db:verify` — all green.
- **The atomicity is proven, not asserted.** `tests/integration/salary-revision.test.ts`
  renames `audit_events` for the duration of the write, so the audit insert fails *after*
  the salary insert has succeeded. The test then asserts **zero** salary rows were written,
  the employee's version was unchanged, and no audit row was left behind (SAL-010).
- **The concurrency control is proven.** Two writers submit against the same
  `expectedVersion`; exactly one wins, the loser receives `SALARY_VERSION_CONFLICT`, and
  nothing is written (CON-001, SAL-011). The check is a conditional update whose
  affected-row count decides the outcome, so there is no window between the check and the
  write (D-033).
- **The eligibility gate is inside the transaction.** A terminated employee's revision is
  refused server-side and writes nothing — the form is not merely hidden (ELG-001, D-034).
- **The write was proven in a browser** against the seeded 10,000-person cohort: the live
  comparison read `Increase of $5,283.06 USD (+7.07%)`, the submission succeeded, the
  success panel reported *"Employee #2521's compensation is now at version 2"*, and the
  profile then showed the new row as a *scheduled* revision while the current salary as of
  15 Nov 2026 was unchanged (SAL-008).
- Every reader-facing state was inspected in the browser: the ineligible employee (no form,
  no link, an explanation that the history stays readable), the validation failure (a
  message beside each field, `aria-invalid`, and "Nothing was saved"), the stale-version
  conflict (the entries kept, with a refresh link), the duplicate effective date, the
  unknown employee, and the 375px layout (no horizontal overflow).

Defects found and fixed during the gate — each is now covered by a test:

| Defect | Rule | Fix |
|---|---|---|
| The FX scale arithmetic used the decimal count as the multiplier, padding to 100,000 digits | MON-002 | The decimal count and the scale multiplier are separate constants; `toScaledUnits(value, decimals, scale)` |
| The USD equivalent divided by 100 a second time | MON-002 | `equivalent_minor = salaryUnits × FX_RATE_SCALE ÷ rateUnits` |
| The duplicate-date check accepted *any* unique violation, so an unrelated constraint was reported as a date conflict | SAL-006 | `isUniqueViolation` requires the named constraint |
| A terminated employee's revision **succeeded** | ELG-001 | The eligibility gate runs inside the transaction (D-034) |
| A stale write reported a misleading duplicate-date error, because the version was checked after the domain rules | CON-001 | The version check runs first — the form no longer describes the employee's state |
| The client form imported the server module, pulling the database into the browser bundle | AGENTS.md §8 | The client-safe result types live in `src/server/revision-outcome.ts` |
| The fixed currency was a **disabled** input, and a disabled input is not submitted by the browser | ELG-004 | It is a `readOnly` text input, so the reader sees it and the server receives it |
| The conflict panel's refresh link read `window.location` during render | AGENTS.md §8 | The path comes from `usePathname()`, so the component can also be rendered on the server (D-035) |
| The conflict test asserted on the restored input before the restore effect had run — green locally, red in CI | AGENTS.md §11 | The assertion waits for the value to arrive, because the panel and the restored fields are two steps, not one |

---

### Phase 5 — Compensation, analytics, data quality
**Goal:** the HR Manager can answer real questions about how the org pays people.

| # | Work | Rules |
|---|---|---|
| 5.1 | `/compensation` — filterable current-salary population | MON-001, ANA-001 |
| 5.2 | Aggregates **grouped by currency**; a labeled USD-equivalent view is a separate, clearly-labelled mode — never a mixed total | MON-004, MON-005, ANA-005 |
| 5.3 | `/analytics` — headcount by country/department/status, median & average by valid grouping, distribution by level | ANA-002, ANA-003, ANA-006 |
| 5.4 | `/data-quality` — deterministic issue rules (missing fields, currency/country mismatch, history anomalies) with counts + links to affected employees | FEATURES.md |
| 5.5 | Charts via Recharts, each with a textual summary (never color-only) | UI.md |
| 5.6 | Aggregate correctness tests: odd/even median, empty set, multi-currency grouping | ANA-003/004/005 |

**Gate 5:** `pnpm test` green; no page ever shows a single number that sums mixed currencies;
aggregates computed in the database, not in JavaScript over 10,000 rows.

---

### Phase 6 — Hardening, performance, deployment
**Goal:** reviewer-ready.

| # | Work |
|---|---|
| 6.1 | Accessibility pass: semantic headings, labels, keyboard paths, visible focus, form errors tied to fields, status not color-only |
| 6.2 | Responsive pass: identity → status → role → location → salary priority; secondary columns collapse into row details |
| 6.3 | `docs/PERFORMANCE.md` — **measure** directory first page, filtered search, profile, history, revision, key aggregate; record dataset size, environment, timing range, query plan, index observations |
| 6.4 | Neon project created; `DATABASE_URL` set in Vercel Dev/Preview/Prod; migrations applied; seed run **explicitly** (never on build) |
| 6.5 | Vercel project linked; production deploy verified from a clean browser; `/api/health` green |
| 6.6 | `docs/AI-USAGE.md` updated with real sessions; `docs/TRACEABILITY.md` + `tests/TEST-MATRIX.md` updated with **real** test paths (no "planned" left) |
| 6.7 | `docs/DEMO-SCRIPT.md` rehearsed against the production URL; screenshots refreshed |
| 6.8 | Final commit: `docs: finalize AI usage, tradeoffs and demo` |

**Gate 6:** full CI green (`lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `build`);
production URL opens in incognito; every test-matrix row points at a real passing test.

---

## 3. Command contract (required by AGENTS.md §3)
```bash
pnpm dev              # local app
pnpm build            # production build
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test             # unit + component (Vitest, no DB)
pnpm test:integration # DB integration (Vitest + PGlite, no server)
pnpm test:e2e         # Playwright, system Chrome
pnpm db:generate      # drizzle-kit generate
pnpm db:migrate       # apply migrations
pnpm db:seed          # deterministic 10k seed
pnpm db:verify        # invariant verification, non-zero on failure
```

`pnpm test` and `pnpm test:integration` are **separate** on purpose: the unit suite must stay fast and
dependency-free so it can run on every save, while integration tests may be slower.

---

## 3a. Git & GitHub push strategy

**Repository:** `https://github.com/mmm-byte/your-hr` (private during development; make public at
submission so reviewers can access it — `docs/ENVIRONMENT.md` §5).

**Branch model — deliberately simple.** One long-lived branch, `main`. No feature branches, no
`develop`, no PR review workflow. This is a single-author assessment repository where the commit
history *is* the artifact being reviewed. A feature-branch model would hide that history behind merge
commits and make the evolution harder to read, not easier.

| Branch | Purpose | Pushed when |
|---|---|---|
| `main` | The complete, always-working product | After every phase gate passes |

**The core rule:** `main` is never broken. Every commit to `main` passes its phase gate. There is no
"fix it in the next commit" and no "broken on main" state. A reviewer can check out any commit in the
history and it should install, build, and pass its tests.

### When to push

| Moment | Action | Rationale |
|---|---|---|
| **End of a phase** (gate passed) | `git push origin main` | The phase is a coherent, reviewable unit. This is the primary push rhythm. |
| **Mid-phase, only if a commit is independently runnable** | `git push origin main` | Keeps remote history live for a reviewer watching progress, without ever pushing a red build. |
| **After every commit** | `git commit` locally, push at phase end | A local commit is cheap; a push is a published claim. |
| **Never** | Push a failing build, a secret, a `.env`, a build artifact, or a WIP commit | Preserves the "every commit works" guarantee. |
| **Phase 6 completion** | Tag `v1.0.0`, publish the public release | Marks the reviewer-facing submission. |

**In practice this means roughly 2–5 pushes per phase**, one at the phase's natural boundaries:
after the toolchain, after the schema, after the query layer, after the UI. Never a single
"everything" push at the end of a phase — that defeats the purpose of incremental history.

### Commit message format

Every commit uses a **Conventional Commits** prefix so the history is scannable, followed by a body
that explains *why* — not *what* (the diff already shows what).

```
<type>(<scope>): <short imperative summary>

<why this change was needed, and what constraint it satisfies>

<rule IDs or decision IDs touched, when relevant>
```

| Type | Used for |
|---|---|
| `docs` | Documentation, decision records, traceability, plans |
| `chore` | Tooling, config, scripts, CI — no product behaviour |
| `feat` | New user-visible capability |
| `fix` | A bug fix |
| `test` | Tests added or changed, including test-first red→green commits |
| `perf` | Measured performance work |
| `refactor` | Behaviour-preserving internal change |
| `build` | Dependency or build-system changes |

**Scope** is the area touched: `db`, `domain`, `ui`, `seed`, `docs`, `ci`, `config`.

### Required trailer

Every commit ends with:

```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### Commit body rules

1. **State the reason.** "Append-only revisions preserve compensation history (SAL-005)" beats
   "Add salary revision".
2. **Name the rule or decision** when the change enforces one — `SAL-010`, `D-015`, `QRY-002`.
3. **Record what was verified** — the exact command and its result. A commit claiming a test passes
   must show the command in the body.
4. **Be honest about limitations.** If something is intentionally deferred, say so in the body.
5. **One capability per commit.** Never mix a dependency upgrade with a feature and a reformat.

### TDD commit honesty

If a test was written **before** the implementation, the commit is `test(...)` and contains only the
test. If the implementation came first, the commit is `feat(...)` or `fix(...)` and its body says so
("implementation and test landed together"). **Never manufacture a fake red-green commit split after
the fact** — that is history falsification, and `AGENTS.md` §16 forbids it.

### What never gets committed

| Excluded | Why |
|---|---|
| `.env`, `.env.local`, any secret file | SECURITY.md — secrets are never committed |
| `node_modules/`, `.next/`, `out/` | Build artifacts, not source |
| `test-results/`, `playwright-report/` | Test artifacts |
| `.vercel/` | Local deployment metadata |
| `*.tsbuildinfo`, coverage output | Generated |
| `drizzle/meta/_journal.json` snapshots that duplicate migrations | Verify before excluding — migration metadata is normally **committed** |
| The `SalaryLens` backup folder outside the repo | Not part of this project |

### Push checklist (run before every push)

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
git status --short          # must show only intended changes
git log --oneline -10       # each commit must have a clear message
```

If any check fails, the commit is not made. If a check fails *after* a commit was already made, fix
it in the next commit rather than amending published history — rewriting history destroys the
"truthful evolution" the assessment asks for.

---

## 4. Definition of "no trouble"

Five properties that must hold at every phase boundary, not just at the end:

1. **One command tells the truth.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` is the
   local gate; CI runs the same commands. No "it probably compiles."
2. **No test depends on wall-clock time, network, or a database server.** Fixed clocks, deterministic
   factories, PGlite for DB.
3. **Every claim in `docs/` maps to a passing test.** The test matrix contains real paths, not "planned".
4. **Every commit is independently runnable.** No commit leaves the repo in a broken state.
5. **Failures are safe.** A blocked phase produces a clear error and a documented decision — never a
   silent workaround, a weakened assertion, or a fabricated number.

---

## 5. Commit rhythm (truthful, one capability per commit)

The list below is the **planned** sequence. It is a guide, not a quota — if the work reveals a
different shape, the history follows the truth of what was built. Every message uses the Conventional
Commits format defined in §3a, and every commit is independently runnable.

```
docs: define product scope, domain rules and environment contract
chore(config): establish pnpm, TypeScript strict, lint and typecheck gates
chore(ci): add lint, typecheck, test and build workflow
feat(health): add safe application and database readiness endpoint
feat(ui): add global shell with navigation, assessment notice and 404 pages
feat(db): add Neon serverless client with transaction-capable driver
feat(db): add relational schema with constraints and generated migrations
test(db): specify employee and salary constraint behaviour
feat(seed): add deterministic 10,000-person workforce seed
feat(seed): add invariant verification for counts, relationships and dates
feat(domain): add money, effective-date and analytics rules
feat(domain): add salary revision eligibility and concurrency rules
feat(ui): add employee directory with server-side query
feat(ui): add employee profile with current salary as-of reporting date
feat(ui): add salary history timeline with provenance
test(domain): specify salary revision transaction and conflict behaviour
feat(salary): revise salary transactionally with append-only audit
feat(ui): add compensation view with currency-grouped aggregates
feat(ui): add analytics with decision-useful summaries
feat(ui): add data quality work queue
perf: measure representative queries on 10,000 employees
docs: finalize AI usage, tradeoffs, traceability and demo
```

**Push points:** after each phase gate (Phase 0, 1, 2, 3, 4, 5, 6), plus additional pushes at the
natural boundaries inside a phase — typically after the schema, after the query layer, and after the
UI within each feature phase. Expected total: **18–24 pushes** across the whole build.

Do not manufacture TDD commits after the fact. If a test is written after the implementation, the
commit message says so.

---

## 6. What is deliberately not being done

| Excluded | Why |
|---|---|
| Authentication / SSO / RBAC | D-006 — the HR Manager is the assumed persona. Would add scope without strengthening salary management. |
| Payroll, tax, benefits, equity, payslips | Outside the product boundary in REQUIREMENTS.md. |
| Live FX | MON-006 — fixed seed FX is a reproducibility device, not a market rate. |
| Natural-language analytics | P2 — filterable analytics already answers the HR question. |
| Redis / cache layer | PERFORMANCE.md forbids it until measurement proves the need. |
| Bulk import UI | P2 — the seed script is the import path for this assessment. |
| Second UI framework, second chart library, second icon set | D-007 — one of each. |
| Fabricating per-row absence/review history | The source data does not contain it (see Phase 1 note). |

---

## 7. Immediate next actions

**Phase 0 — complete.** Gate 0 passed on 2026-11-12: `pnpm install`, `pnpm lint`,
`pnpm typecheck`, `pnpm test` (8 files, 110 tests), and `pnpm build` all green,
with a smoke check confirming the shell renders, the assessment notice is present,
the 404 page works, and `/api/health` returns a safe degraded payload when no
database is reachable.

**Phase 1 — complete.** Gate 1 passed on 2026-11-13: `pnpm db:generate` (no drift),
`pnpm db:migrate`, `pnpm db:seed` (10,000 employees, 22,093 salary rows), and
`pnpm db:verify` (**29/29 checks passed**, exit code 1 on an injected violation).
The seed refuses a rerun and the migration runner skips applied files, so both are
safe to repeat. `pnpm lint`, `pnpm typecheck`, `pnpm test` (11 files, 154 tests),
`pnpm test:integration` (3 files, 38 tests), and `pnpm build` are green.

**Phase 2 — complete.** Gate 2 passed on 2026-11-13: `pnpm test` (15 files, **214 tests**,
**0.4 s** — the budget is under 5 s), `pnpm lint`, `pnpm typecheck`, `pnpm build`, and
`pnpm test:integration` are all green. No Phase 2 module performs I/O; the boundary schemas
import only `@/lib/domain-values` and `@/lib/date-only`.

Five domain defects were found and fixed during the phase, each with a regression test:

| Defect | Fix |
|---|---|
| `toMinorUnits` silently truncated a third decimal place | Rejects it — the column is `numeric(12,2)` (D-026) |
| `toMinorUnits` rejected negative amounts, so it was not a true inverse | Accepts a leading `-` |
| `formatMoney` routed the amount through `Number()`, losing a cent at the top of the range | Formats the exact decimal **string**; rejects a malformed amount instead of rendering `$NaN` |
| `totalSameCurrency` could not enforce its own single-currency guard | Takes `Money[]`, so a mixed-currency total cannot be expressed (RPT-007) |
| The bonus percentage was compared with `Number()` | Compared as hundredths of a percent in `BigInt` (SAL-003) |

Two structural changes were also made:

- **`src/lib/domain-values.ts`** (new) declares every closed value set once, as a readonly
  tuple. `src/db/schema.ts` derives its `pgEnum` declarations from those tuples — the
  regenerated migration was **byte-identical**, which proves the database shape did not
  change (D-024).
- **`src/schemas/*.ts`** (new) holds the Zod boundary contracts: a bounded page size
  (default 25, cap 100, clamped rather than rejected), allow-listed sorts and groupings,
  and no silent coercion (D-025).

**Phase 3 — done.** The first vertical slice: the employee directory and profile. Gate 3 passed
2026-11-13; see the Gate 3 section above for the evidence and the defects that were found and
fixed while proving it.

**Phase 4 — done.** The salary revision: the critical mutation path. Gate 4 passed
2026-11-16; see the Gate 4 section above for the evidence and the defects that were found
and fixed while proving it.

**Phase 5 — next.** Compensation, analytics, and data quality — the read side of the
numbers the HR Manager actually asks questions about.

1. `/compensation` — the filterable current-salary population, with the aggregates
   **grouped by currency** so no page ever shows one number that sums six currencies
   (MON-004, ANA-005).
2. `/analytics` — headcount by country, department, and status; median and average by a
   valid grouping; the distribution by level (ANA-002, ANA-003, ANA-006).
3. `/data-quality` — deterministic issue rules with counts and links to the affected
   employees (FEATURES.md).
4. Charts via Recharts, each with a textual summary, never colour alone (UI.md).
5. The aggregates are computed in the database, not in JavaScript over 10,000 rows, and
   the aggregate correctness tests cover the odd/even median, the empty set, and the
   multi-currency grouping (ANA-003/004/005).

**Open items requiring your decision (not blocking — the recommended default will be used):**

| # | Question | Recommended default |
|---|---|---|
| Q1 | Absence/performance tables: seed snapshots only, or synthesize dated rows? | **Snapshots only** — do not fabricate history the source lacks (D-018) |
| Q2 | Confirm system Chrome for E2E instead of downloading Playwright's Chromium? | **Yes** — saves ~500 MB on a nearly-full disk (D-010) |
| Q3 | Is the redundant `/Users/mahindragupthakotha/SalaryLens` backup safe to delete? | **Yes**, once you confirm the restore looks right |
| Q4 | Neon account available to create the production database now, or later in Phase 6? | **Later** — Phase 0–5 need no database at all |
| Q5 | Repository visibility during development? | **Private now, public at submission** so reviewers can access it |
| Q6 | Neon connection string for local development? | Needed only from Phase 1; PGlite covers all testing until then |
