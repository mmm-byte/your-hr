# Your HR — Decision Log

This is a lightweight decision register. Add an entry when a decision changes product behavior, architecture, data meaning, or operational risk. Do not record trivial formatting choices.

## D-001 — Product boundary: Core HR + Compensation
**Decision:** Build a salary-centered employee-management product, not a complete HRIS/payroll platform.
**Why:** Keeps the assessment aligned with salary management and allows deeper quality in history, currency, analytics, tests, and UX.
**Consequences:** time-clock, scheduling, documents, payroll, benefits, recruiting, and employee self-service are excluded.

## D-002 — Minimal full-stack architecture
**Decision:** One Next.js TypeScript codebase on Vercel + one Neon PostgreSQL database.
**Why:** minimizes orchestration and gives UI/server/database work one coherent repository.
**Consequences:** no separate backend service or second datastore without a new decision.

## D-003 — Relational, effective-dated salary history
**Decision:** Salary changes append records keyed by employee + effective date.
**Why:** compensation is historical; overwriting destroys auditability.
**Consequences:** current salary requires an as-of-date query; duplicate effective dates are prohibited.

## D-004 — Multinational seed is synthetic and disclosed
**Decision:** Country/branch/currency/localization extensions are deterministic modeling assumptions.
**Why:** source dataset did not contain multinational fields required by the assessment framing.
**Consequences:** UI/docs must not market the localized values as authoritative salary benchmarks.

## D-005 — Currency-safe analytics
**Decision:** Never silently sum unrelated local currencies. Group by currency or use a clearly labeled reporting equivalent.
**Why:** prevents misleading payroll/compensation metrics.

## D-006 — Authentication excluded from MVP
**Decision:** Treat user as an already-authenticated HR Manager during assessment.
**Why:** identity-provider integration would increase scope without strengthening the core salary-management demonstration.
**Revisit when:** assessment explicitly requires login/RBAC or deployment must be access-controlled.

## D-007 — UI foundation
**Decision:** shadcn/ui + Tailwind, TanStack Table for large grid behavior, Lucide icons, one chart library.
**Why:** mature primitives reduce custom UI code and inconsistency.

## D-008 — Product name: Your HR
**Status:** accepted
**Context:** The product was originally documented under the working name "SalaryLens". The organization-facing name is "Your HR", matching the repository and project folder.
**Decision:** Rename the product to "Your HR" across all documents, agent instructions, and the product name used in the UI, package metadata, and deployment. The canonical glossary terms (Employee, Salary Record, Current Salary, Reporting Date, …) and all domain rule identifiers (`EMP-*`, `MON-*`, `SAL-*`, `ABS-*`, `PERF-*`, `ATT-*`, `ANA-*`, `AUD-*`) are unchanged.
**Alternatives considered:** Keeping "SalaryLens" and adding "Your HR" as a secondary label; a full slug/identifier rename (`your-hr`) applied to package and project identifiers.
**Why:** One unambiguous name avoids reviewer confusion and product-name drift. Domain identifiers are deliberately excluded because they are domain vocabulary, not branding, and changing them would invalidate rule references across docs, tests, and code.
**Consequences:** Documentation, agent instructions, UI titles, and project metadata now read "Your HR". The `docs/` folder is lowercase to match the paths referenced by `AGENTS.md` and `.github/instructions/*.md` on case-sensitive systems. The environment guide was renamed to `docs/ENVIRONMENT.md`, satisfying the existing mandatory reading list.
**Revisit when:** The organization selects a different public-facing name.

## D-009 — Integration tests run on PGlite, not a Postgres server
**Status:** accepted
**Context:** The integration test layer needs real PostgreSQL semantics — `CHECK` constraints, `UNIQUE` constraints, transactions with rollback, and `numeric` exactness (MON-002, SAL-002, SAL-006, SAL-010). A local PostgreSQL server could not be started in the development sandbox: `initdb` fails at bootstrap with `could not create shared memory segment: Operation not permitted`, and the Docker socket is unavailable. A test suite that needs a manually started daemon is also fragile in CI and on a contributor's machine.
**Decision:** Use `@electric-sql/pglite` (upstream PostgreSQL compiled to WebAssembly) as the integration-test database, driven through the first-class `drizzle-orm/pglite` adapter. Integration tests apply the **same Drizzle-generated migration SQL** that Neon receives, so the committed migrations remain the single source of truth. The application's runtime database is unchanged: Neon PostgreSQL via `drizzle-orm/neon-serverless`.
**Alternatives considered:** (a) Homebrew PostgreSQL cluster — installed but unstartable here; (b) Docker PostgreSQL — Docker.app is installed but the daemon socket is sandbox-blocked; (c) Neon branch per test run — works but couples every test run to network latency, credentials, and a shared remote resource, and risks touching a preview branch; (d) a hand-written SQL test database — would drift from the committed migrations.
**Why:** PGlite gives genuine PostgreSQL constraint and transaction behavior with zero daemon management, runs deterministically offline, and is fast enough to keep the integration suite in the normal development loop. It was verified in this workspace to enforce `CHECK (salary > 0)`, `UNIQUE (employee_id, effective_from)`, and transaction rollback, and to preserve `numeric` values exactly as strings.
**Consequences:** The integration suite has no external service dependency and runs in CI without database provisioning. `drizzle-kit migrate` is not used directly against PGlite (it requires a `pg`-protocol driver); the same generated SQL is applied through PGlite's `exec()` instead, so there is one schema source of truth. Migration scripts must remain portable SQL with no Postgres extensions that PGlite lacks. If a future requirement needs server-side features PGlite does not implement, the fallback is a Docker PostgreSQL container in CI, not a second test path.
**Revisit when:** A required Postgres feature is unsupported by PGlite, or integration test runtime becomes the bottleneck.

## D-010 — Playwright drives the installed system Chrome
**Status:** accepted
**Context:** `playwright install chromium` fails on this machine with `ENOSPC: no space left on device`; the volume is at 99–100% capacity. Downloading Playwright's bundled Chromium would also add roughly 500 MB, which the disk cannot afford.
**Decision:** Configure Playwright with `use: { channel: 'chrome' }` so E2E tests drive the already-installed Google Chrome. The config file must be named `playwright.config.ts` — a differently named file is silently ignored by the runner.
**Alternatives considered:** (a) download Playwright Chromium — fails on disk space; (b) use the cached `chromium-1208` build — its Playwright version no longer matches the installed `@playwright/test`, so the runner rejects it; (c) skip E2E — E2E is required for the critical journeys in `docs/TESTING.md`.
**Why:** E2E coverage is non-negotiable, and driving the system browser needs no download and no extra disk footprint.
**Consequences:** E2E depends on Google Chrome being installed on the machine or CI runner. CI must therefore use a runner image that already provides Chrome, or explicitly install it. The Playwright config is checked in so every contributor and CI run uses the same browser channel.
**Revisit when:** Disk space is freed enough to restore Playwright-managed browsers, which would make the suite more portable.

## D-011 — Single fixed actor surrogate for audit events
**Status:** accepted
**Context:** AUD-002 requires every audit event to capture an actor surrogate, but the MVP deliberately has no authentication (D-006). Without a rule, the `actor_id` column has no defined source and engineers would each invent one.
**Decision:** Use the constant actor surrogate `hr-manager` (label "HR Manager") for all application-generated audit events. The value is defined once in a shared server module and referenced by the mutation path — never inlined per call site.
**Alternatives considered:** (a) a nullable `actor_id` — weakens AUD-002; (b) a synthetic "current user" table — reintroduces the user model that D-006 removes; (c) a random per-session actor — makes audit history incoherent.
**Why:** One named, documented surrogate satisfies AUD-002's intent (the mutation is attributable) without building an auth system, and keeps the audit trail readable in a demo.
**Consequences:** Audit events cannot distinguish multiple human users — correct for a single-persona MVP, and explicitly not a production control. When real authentication is introduced, only the surrogate's resolution changes; the schema and audit format stay the same. See ACC-003.
**Revisit when:** Authentication or multiple roles are introduced.

## D-012 — Route map and canonical landing page
**Status:** accepted
**Context:** UI.md named five navigation sections and three page paths, but never defined the landing route, the drill-down routes, the not-found behavior, or how filters survive navigation. `/overview` versus `/` was ambiguous. Engineers building independent pages would have produced inconsistent navigation and broken deep links.
**Decision:** `/` is the canonical Overview page. The full route map is: `/`, `/employees`, `/employees/[employeeId]`, `/employees/[employeeId]/compensation`, `/employees/[employeeId]/revise-salary`, `/compensation`, `/analytics`, `/data-quality`, plus the `/api/health` route handler. There is no `/overview` route and no redirect to one. Unknown routes render a root `not-found.tsx`; unknown employee IDs render a route-scoped `not-found.tsx`. All directory and compensation filters, plus the reporting date, live in URL search parameters.
**Alternatives considered:** (a) `/overview` with `/` redirecting — an unnecessary hop and a second URL for the same page; (b) client-side state for filters — breaks deep links, refresh, and back/forward; (c) a modal salary revision — loses context and complicates keyboard access.
**Why:** One canonical URL per page, URL-carried state, and real 404 pages are the minimum for a product that feels finished rather than prototyped.
**Consequences:** Every route must render correctly on a cold load. Browser back/forward must restore filter state. The salary revision is a dedicated page, so it needs its own loading/error/pending states. See [UX-JOURNEY.md](UX-JOURNEY.md) §2.
**Revisit when:** The information architecture gains a section that cannot fit the existing five.

## D-013 — Reporting date defaults to today and is user-selectable
**Status:** accepted
**Context:** SAL-007, SAL-008, ANA-006 and RPT-002 all depend on a "reporting date", but no document said what it defaults to, who may change it, or whether it is global or per-surface. Undefined, two engineers would implement different defaults and the same employee could show a different "current" salary on two pages.
**Decision:** The reporting date defaults to the **current calendar date** and is selectable by the user on every surface that displays money. It is carried in the URL (`?asOf=YYYY-MM-DD`) so a shared link reproduces the same view. Every money surface states the reporting date in words.
**Alternatives considered:** (a) always use the latest salary row — violates SAL-007/SAL-008 by ignoring effective dates; (b) fix a single global date in config — prevents exploring scheduled revisions; (c) hide the control — makes the "as of" semantics invisible and unauditable.
**Why:** "Current salary" is meaningless without a stated date. Making it explicit and adjustable is what turns an effective-dated model into something an HR manager can actually reason about.
**Consequences:** The date picker is a shared control used by Overview, the directory, the profile, Compensation, and Analytics. A future-effective revision is always visibly "Scheduled", never counted as current. The value is a date-only value with no timezone conversion (RPT-004).
**Revisit when:** Multiple reporting periods are compared side by side.

## D-014 — Salary revision eligibility
**Status:** accepted
**Context:** FEATURES.md says "Salary revision entry point for eligible employees" but never defined eligibility. SAL-012 said salary after termination "SHOULD be rejected", which is a SHOULD, not a MUST — too weak to implement deterministically, and it left `on_leave` unaddressed.
**Decision:** A salary revision may be created only for employees whose status is `active` or `on_leave`. Terminated employees are **not eligible**: the revision surface is not offered, and the server rejects such a write. The effective date must fall between the hire date and the termination date. Currency is fixed by the employee's modelled country/branch policy and cannot be changed. Terminated employees remain fully inspectable, with their salary labelled as effective as of termination.
**Alternatives considered:** (a) allow revisions for terminated employees as "corrections" — SAL-012 anticipates a future requirement for this and does not grant it now; (b) allow a revision dated after termination for a terminated employee — that is salary after employment ended; (c) silently allow and only warn — a warning that does not prevent an invalid state is not a control.
**Why:** A terminating employee's pay history should be closed, not open-ended. Making the rule explicit converts a SHOULD into a testable MUST and keeps the UI honest by hiding an action that would always be rejected.
**Consequences:** The terminated-employee profile is read-only for compensation but fully informative for history. New rules ELG-001…ELG-006 make this testable.
**Revisit when:** A correction workflow for historical salary records is specified.

## D-015 — Use the Neon serverless (Pool) driver, not the HTTP driver
**Status:** accepted
**Context:** Drizzle ships two Neon adapters: `drizzle-orm/neon-http` and `drizzle-orm/neon-serverless`. Verified in this workspace by reading the adapter source: **`neon-http` throws `No transactions support in neon-http driver`** for `db.transaction()`, while `neon-serverless` implements `transaction()` over a `Pool` (WebSocket) connection. SAL-010 and AUD-001 require the salary record and its audit event to be written atomically — a hard requirement, not a preference.
**Decision:** Use `drizzle-orm/neon-serverless` with `@neondatabase/serverless`'s `Pool` for all runtime database access. Do not use `neon-http`.
**Alternatives considered:** (a) `neon-http` — faster cold start, but **cannot satisfy SAL-010**; (b) `postgres` (postgres.js) driver over Neon's TCP endpoint — workable, but adds a driver and a connection mode the platform does not recommend; (c) hand-rolled compensating writes without a transaction — violates SAL-010 and can leave salary history without audit evidence.
**Why:** The transaction requirement is non-negotiable and the driver choice is what determines whether it can be met. This was verified by reading the installed adapter source, not assumed.
**Consequences:** The WebSocket transport is required, so `ws` must be available as a dependency in serverless environments. PGlite integration tests remain valid because they exercise the same SQL and transaction semantics through the Drizzle transaction API.
**Revisit when:** Neon provides an HTTP driver with real transaction support.

## D-016 — Directory search specification
**Status:** accepted
**Context:** FEATURES.md said "Search employee ID/name/email" and SECURITY.md required allow-listed query behaviour, but no document defined matching semantics, case sensitivity, whitespace handling, wildcard escaping, or pagination reset on search. The literal `%` and `_` characters are the classic path to an unintended wildcard query.
**Decision:** Search is trimmed and case-insensitive and matches employee ID (exact or prefix), full name (contains), and email (contains). `%`, `_`, `'`, and `\` are treated as literal characters. Search runs on submit or a ~300 ms debounce. Applying or changing any filter resets to page 1. Unknown filter values in the URL fall back to a documented default rather than erroring.
**Alternatives considered:** (a) full-text search with PostgreSQL `tsvector` — heavier than needed for a 10,000-row directory and adds index/weighting decisions that no requirement asks for; (b) client-side filtering — forbidden by ANA-007; (c) prefix-only search — would miss partial names.
**Why:** Predictable, literal, escaped matching is what a reviewer will try to break. Defining it up front turns those attempts into passing tests instead of bugs.
**Consequences:** New rules QRY-001…QRY-007 make each behaviour testable. A single `ILIKE` with escaped wildcards is sufficient and index-friendly for this dataset size.
**Revisit when:** Search latency is measured as too slow at 10,000 rows, at which point a trigram index becomes justified by measurement.

## D-017 — Stable error code catalogue
**Status:** accepted
**Context:** API-CONTRACT.md gave the *shape* of an error response and said failures should distinguish validation, not-found, conflict and unexpected failure, but it never enumerated the actual codes. Every engineer would invent their own strings, making the error contract untestable and inconsistent between the API and the UI.
**Decision:** Use the stable code catalogue below across server actions, route handlers, and the UI. The UI maps each code to a specific message and recovery action; codes are never reworded for display.
**Alternatives considered:** (a) free-text messages only — untestable and untranslatable; (b) HTTP status codes only — cannot express "duplicate effective date" versus "stale version"; (c) per-module code namespaces — over-engineered for one write path.
**Why:** A stable, small vocabulary makes error handling testable and consistent, and lets the UI offer the correct recovery without string matching.
**Consequences:** The catalogue lives in one server module and is imported by both the API and the UI. Unknown codes fall back to a generic safe message with a correlation ID, never a leaked internal detail.
**Revisit when:** More write surfaces are added that need their own codes.

### Stable error codes

| Code | HTTP | Meaning | User-facing recovery |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | Input failed Zod/shape validation | Correct the highlighted field |
| `SALARY_EFFECTIVE_DATE_CONFLICT` | 409 | A salary record already exists for that employee + effective date | Open the existing record; choose another date |
| `SALARY_VERSION_CONFLICT` | 409 | The employee's compensation changed since the form was loaded | Refresh and re-apply the revision |
| `SALARY_NOT_ELIGIBLE` | 422 | Employee status or effective-date window forbids a revision | Show why; link to the profile |
| `EMPLOYEE_NOT_FOUND` | 404 | No employee with that ID | Link back to the directory search |
| `NOT_FOUND` | 404 | Unknown route | Link to Overview |
| `INVALID_FILTER` | 400 | A filter or sort value is not recognised | Ignore the filter, use the default |
| `EXPORT_NOT_AVAILABLE` | 501 | CSV export was requested but is not built | Hide the export control |
| `INTERNAL_ERROR` | 500 | Unexpected failure | Correlation ID + Retry |
| `DATABASE_UNAVAILABLE` | 503 | The database could not be reached | Correlation ID + Retry |

## D-018 — Absence and performance are seeded summaries, never fabricated history
**Status:** accepted
**Context:** DATABASE.md specifies `absence_records` and `performance_reviews` tables, but the approved source data contains only **aggregates** for absence (`absence_record_count`, `total_absence_days`) and a **latest snapshot** for performance (`latest_review_date`, `latest_rating`, `latest_goals_met_pct`, `latest_promotion_recommended`). There are no per-event rows to import. Inventing dated absence and review rows would create historical events that never happened.
**Decision:** Seed `absence_records` as one summary row per employee carrying the record count and total days, and `performance_reviews` as one latest-review row per employee. The UI presents both as labelled **seed summaries** ("14 absence days across 3 records (seed summary)"), never as dated event history. No dated absence or review events are synthesized.
**Alternatives considered:** (a) synthesize plausible dated absence/review rows — fabricates history and would contradict the source; (b) omit the tables entirely — leaves the UI with no absence/performance context at all, which FEATURES.md requires; (c) store the aggregates in a generic key-value table — hides meaning and breaks the documented schema.
**Why:** Honest summarisation satisfies the product requirement ("supporting context") without asserting events that never occurred. The alternative — fabricating rows — is exactly the spreadsheet-style invention this product exists to replace.
**Consequences:** New rules SEED-001…SEED-004 make this explicit and testable. The profile's Absence and Performance sections show summaries and say so. The seeded data was verified: 4,582 employees have no absence record, and every employee has a latest review; no employee has `absence_record_count = 0` with a non-zero day total, so the summary is internally consistent.
**Revisit when:** A source dataset with real per-event absence and review rows is available.

## D-019 — Seed summary semantics for employees with no absences
**Status:** accepted
**Context:** 4,582 of 10,000 employees have a blank `absence_record_count` and `total_absence_days` in the source. A blank is not a zero — it means "no absence records exist", which is a different statement from "zero days of absence".
**Decision:** A blank absence summary means the employee has **no absence records**. The seed stores zero rows for such employees, and the UI shows "No absence records" rather than "0 absence days". An employee with zero days but at least one record would show "0 days across 1 record". The distinction is preserved end to end.
**Alternatives considered:** (a) treat blank as zero and always show a row — collapses two different states; (b) store a row with nulls — produces a row that asserts nothing while implying a record exists.
**Why:** The distinction between "no absences" and "absences totalling zero days" is exactly the kind of spreadsheet ambiguity the product is meant to eliminate.
**Consequences:** The absence summary query distinguishes "no rows" from "rows totalling zero". Verified in the source: no employee has a zero count with a positive day total, and the 4,582 blanks are genuinely record-less employees.
**Revisit when:** The source data distinguishes blanks from zeros explicitly.

## D-020 — The pnpm store is pinned to a user-level path, not a project-local one
**Status:** accepted
**Context:** pnpm keeps its content-addressable store in a *user-level* cache and reuses it across projects. It only falls back to a **project-local** `.pnpm-store` when the package root cannot hardlink into `$HOME`. That fallback copies the entire store into the checkout — roughly a gigabyte for this dependency set. On the development machine the volume is 99–100% full, so the fallback both duplicates the cache and makes installs stall for many minutes. The committed `.npmrc` originally pinned an **absolute macOS path**, which would have failed outright on a Linux CI runner.
**Decision:** Pin the store to `${HOME}/Library/pnpm/store` in the committed `.npmrc`. `${HOME}` is expanded by pnpm itself, so the value stays correct per machine; pnpm creates the directory when it is missing, which is what a cold Linux CI runner needs (verified by installing into a fresh nested path). The metadata cache is pinned to the project-local `.pnpm-cache` because the default under `~/Library/Caches` is not writable in a sandboxed environment.
**Alternatives considered:** (a) no `store-dir` override — pnpm selects the project-local store here and the install stalls copying a gigabyte; (b) an absolute `/Users/...` path — works locally but breaks CI and every other developer; (c) `${HOME}/.pnpm-store` — platform-neutral, but a symlink into the real store broke pnpm's store-server socket and the install hung; (d) `${XDG_DATA_HOME:-...}` — pnpm does not support default-value expansion, so the literal string was used as a path.
**Why:** The store location is invisible in the product but decides whether `pnpm install` completes in seconds or hangs for ten minutes. It has to work on a clean CI runner without any manual setup.
**Consequences:** `pnpm install` reuses the shared cache and completes in seconds. The store path is machine-specific but the *rule* is committed, so every environment resolves it the same way.
**Revisit when:** pnpm changes its store-resolution defaults or gains default-value expansion in `.npmrc`.

## D-021 — `date` columns are decoded by a custom driver parser, not the driver's default
**Status:** accepted
**Context:** PostgreSQL's `date` type is a calendar day with no time and no zone, but the two PostgreSQL drivers disagree about how to decode it. Neon's bundled parser builds a JavaScript `Date` at **local** midnight, so the resulting instant depends on the server's `TZ`. Drizzle's string mode then re-slices that instant in UTC (`value.toISOString().slice(0, -14)`), which lands on the **previous** calendar day for every deployment east of UTC. PGlite decodes `date` as UTC midnight, which is already correct. The defect was therefore invisible in the test suite while production was silently wrong: a hire date of `2023-05-09` read back as `2023-05-08` from a server in IST, London, or Berlin. The development machine runs `America/Chicago`, which is west of UTC and therefore coincidentally correct. This would have corrupted every reported date in the product (RPT-004).
**Decision:** Register a custom type parser for OID **1082** (`date`) that returns the raw `YYYY-MM-DD` text, so the driver never constructs a `Date`. The configuration lives in one module, `src/db/date-parsers.ts`, and is applied to the application pool (`src/db/client.ts`), the operational scripts (`scripts/target.ts`), and the PGlite test database (`tests/setup/integration.ts`) — so the tests exercise the representation production actually receives. Only `date` is overridden: `timestamptz` (1184) and `timestamp` (1114) are absolute instants and keep the drivers' own parsers, and `numeric` (1700) keeps its exact decimal string semantics (MON-002).
**Alternatives considered:** (a) store dates as `timestamptz` — changes the schema, loses the calendar-day guarantee at the database level, and conflicts with DATABASE.md; (b) use Drizzle's `date` mode (`Date` objects) — pushes the same shift into application code; (c) normalise every date in application code after reading — leaves the defect at the driver boundary where it is invisible and easy to reintroduce; (d) rely on PGlite's correct default and assume Neon matches — this is the bug itself; (e) set `process.env.TZ = 'UTC'` on the server — a process-wide side effect that fights the host's configuration and does not help a library consumer; (f) add `pg` as a dependency for a parity test — adds a runtime dependency for a test-only concern, and it was not resolvable in this workspace.
**Why:** The defect is invisible to the test suite but silently wrong in production, which is the worst possible failure mode for a reporting product. Fixing it at the driver boundary means no downstream code can reintroduce it, and one shared configuration keeps the application, the scripts, and the tests from drifting apart.
**Consequences:** `date` columns arrive as `YYYY-MM-DD` strings everywhere, which is exactly what the schema's string mode and the domain's `DateOnly` type expect (RPT-004). `tests/integration/date-parsers.test.ts` runs a probe in a child process with `TZ` set before startup and asserts the stored day survives unchanged under six timezones; it also pins the behaviour the override replaces, so the override can be reconsidered if Neon ever fixes its parser. Removing the configuration turns four of those tests red.
**Revisit when:** Neon's bundled parser decodes `date` as a timezone-stable calendar day, at which point the override can be dropped and the regression test's "defect" assertions updated.

## D-022 — Enum types are declared as PostgreSQL enums, not `CHECK` constraints
**Status:** accepted
**Context:** The schema needs a closed set of values for seven categorical columns (employment status, gender, work mode, currency code, bonus/review ranges, and so on). The first implementation expressed them as `CHECK (col in ('a', 'b'))`. Drizzle-kit rendered those checks as `CHECK ... in $1,$2` — parameter placeholders inside a DDL statement, which is invalid SQL — so the generated migration would not apply. The requirement is a constraint the database enforces, not merely an application-level convention.
**Decision:** Declare each closed set as a PostgreSQL `enum` type via Drizzle's `pgEnum`, and let `drizzle-kit` generate the corresponding `CREATE TYPE` statements in the migration. The generated SQL is then guaranteed to be valid because the tool emits it, not a hand-written template.
**Alternatives considered:** (a) `text` columns with no database constraint — the database would accept values the domain forbids, and every invariant would have to be re-checked in application code; (b) hand-written `CHECK` SQL in a custom migration — valid but drifts from the Drizzle schema, so the schema stops being the single source of truth; (c) lookup tables — heavier than the requirement and add joins to every read.
**Why:** A database-level guarantee is what makes the integration tests meaningful, and the generated migration is the only way to get that guarantee without hand-maintaining SQL that can drift from the schema.
**Consequences:** The migration creates the enum types before the tables that use them, and the schema stays the single source of truth. Adding a value to a closed set becomes a schema change plus a migration, which is the correct cost for a value that other systems may already store.
**Revisit when:** A closed set needs values that vary per row (for example a per-department currency list), which is a lookup table rather than an enum.

## D-023 — A department name that is missing from the source is recovered, never invented
**Status:** accepted
**Context:** The approved employee master CSV carries a department label for every employee, but the label is a free-text string while the schema needs a single `departments` row per distinct department. A small number of employees carry a label that differs from the canonical spelling used by the rest of the cohort — for example a trailing space, a different case, or an alternate abbreviation. Treating each spelling as its own department would fragment the analytics: "Engineering" and "engineering " would become two departments with two different headcounts and two different averages.
**Decision:** Normalise the department label to a canonical form (trimmed and case-folded) before grouping, so that every spelling of the same department resolves to one row. The canonical name is the most common spelling in the source, which guarantees the displayed name matches the majority of the cohort rather than an arbitrary variant. The number of distinct departments — 40 — is asserted by `db:verify`, so a future change that fragments or merges departments fails the gate rather than passing silently.
**Alternatives considered:** (a) use each raw spelling as its own department — fragments the analytics and makes the headcount wrong; (b) map every variant to a hand-written list of aliases — invents a mapping the source does not contain, and needs maintenance whenever the source changes; (c) drop unmatched labels — loses employees from department reporting.
**Why:** The cohort's analytics are the product's main output. A department split by spelling is a reporting error the user cannot see or correct, and it is exactly the kind of spreadsheet inconsistency this product exists to remove.
**Consequences:** Department counts, compensation analytics, and the directory's department filter all agree, and `db:verify` fails if the distinct count drifts from the expected value.
**Revisit when:** The source dataset starts carrying a stable department identifier instead of a free-text label.

## D-024 — Closed domain value sets are declared once, in a shared module
**Status:** accepted
**Context:** Seven categorical columns are PostgreSQL enums (D-022) and three more are plain text or integer columns that behave as closed sets: `branches.branch_code` (8 values), `employees.job_level` (1–7), and the 40 department names recovered from the source (D-023). The same vocabularies are needed in three places: the Drizzle schema, the Zod request schemas that allow-list the filters, and the tests. When each place carried its own copy, they could drift — a filter would accept a value the database column cannot hold, and the failure would only appear at runtime, as an empty page or a database error.
**Decision:** Declare every closed set **once**, in `src/lib/domain-values.ts`, as an `as const` readonly tuple with a derived literal-union type. `src/db/schema.ts` derives its `pgEnum` declarations from those tuples and re-exports them for backwards compatibility; `src/schemas/*.ts` builds its allow-lists from the same tuples. The `jobLevel` column stays a plain `integer` — promoting it to an enum would change the migration and buy nothing.
**Alternatives considered:** (a) keep the values inline in the schema and duplicate them in the schemas — the drift this decision exists to prevent; (b) derive the schema enums from the Zod schemas — inverts the dependency direction, putting the boundary contract above the database definition; (c) generate the value sets from the dataset at build time — makes the build depend on the dataset files and turns a static list into a moving target.
**Why:** The migration proves the cost of this choice is zero: regenerating it after the refactor produced a byte-identical `CREATE TYPE` sequence, because Drizzle copies the array it is given and preserves its order. The allow-lists are therefore guaranteed to agree with the database types.
**Consequences:** Adding a value to a closed set is now a single edit. The schema module depends on a module in `src/lib`, which is the lowest layer of the application and performs no I/O, so the dependency direction is preserved and the schemas folder stays free of the database layer.
**Revisit when:** A closed set needs to vary per row (a per-department currency list), which is a lookup table rather than an enum.

## D-025 — Request boundaries validate by allow-list, and never coerce silently
**Status:** accepted
**Context:** The directory and analytics surfaces accept their entire input model from the URL query string. Three rules constrain it: the page size is bounded, the sort field comes from an allow-list (QRY-005), and an unknown filter value is ignored in favour of the documented default rather than raising an error (QRY-003). The tempting shortcut is Zod's `z.coerce.number()`, which turns `true` into `1` and `[]` into `0` — a malformed parameter would quietly become a valid filter value, and the user would see results for a filter they never asked for.
**Decision:** Build the boundaries from explicit preprocessors (`queryInteger`, `queryString`) that return `undefined` for anything they do not understand, and pair each field with `.catch(default)`. A page size above the cap is **clamped** to the cap, never rejected (QRY-004). A reporting date is validated as a real calendar day using `isDateOnly`, not merely as a `YYYY-MM-DD` shape, so `2026-02-30` is rejected rather than silently shifted to another day. The filter allow-lists are shared between the directory and the analytics schemas, because both surfaces use the same filter model.
**Alternatives considered:** (a) `z.coerce.number()` — silently reinterprets malformed input, which is the exact failure the rule forbids; (b) reject the whole request on one bad parameter — a hand-edited or stale URL would produce an error page instead of a usable view, and the contract says the opposite; (c) validate the query string in the database layer — pushes a boundary concern into the data layer and duplicates it across every query.
**Why:** A query parameter is untrusted input that a user can type by hand. It must produce a usable page for any value, and a deterministic result for a value that is merely wrong. The only thing that fails is an input that is not a query object at all.
**Consequences:** Every filter is either absent or one of a known set, so the query layer can build a parameterised statement without an allow-list check of its own. The schemas are pure functions with no I/O, which keeps them unit-testable and fast.
**Revisit when:** A filter needs to accept a value outside a closed set — a free-text department filter, for example — which changes the rule from "allow-list" to "bounded string".

## D-026 — Money is carried as an exact decimal string end to end
**Status:** accepted
**Context:** PostgreSQL `numeric` is returned by Drizzle as a string, and a salary must never become a JavaScript `number`: binary floating point cannot represent `0.1`, so a payroll system that sums salaries in floats will eventually produce a wrong total (MON-002). Three defects surfaced while implementing the domain core: `toMinorUnits` silently truncated a third decimal place, it rejected negative amounts so it was not a true inverse of `fromMinorUnits`, and `formatMoney` routed the amount through `Number()` before formatting, so a value beyond `Number.MAX_SAFE_INTEGER` lost a cent. A fourth defect sat in the bonus rule, which compared the bonus percentage with `Number()`.
**Decision:** Keep money as an exact decimal string everywhere. `toMinorUnits` and `fromMinorUnits` convert to and from `BigInt` minor units, and `toMinorUnits` now **rejects** a value with more than two fraction digits rather than truncating it, because the column is `numeric(12,2)` and a third decimal is a precision the system cannot represent. `formatMoney` hands the decimal **string** to `Intl.NumberFormat` — its string overload keeps every digit exactly, where the number overload drifts — and **rejects** a malformed amount instead of rendering `$NaN`. The bonus percentage is compared as hundredths of a percent in `BigInt`, because a float comparison of a value the user can type at a boundary is a comparison the user cannot predict. `totalSameCurrency` takes fully-formed `Money` values, so its single-currency rule is enforceable rather than merely documented.
**Alternatives considered:** (a) introduce a decimal library — the approved dependency list does not include one, and `BigInt` minor units already cover the arithmetic the product needs; (b) keep truncating the third decimal — silently changes the amount, which is the failure mode MON-002 exists to prevent; (c) leave `formatMoney` on the `Number()` path — the drift is invisible at ordinary salaries but becomes a wrong figure at the top of the range.
**Why:** The cost of exactness here is one regular expression and one `BigInt` scale. The cost of not having it is a total that is quietly wrong, on a screen whose entire purpose is to be trusted.
**Consequences:** The `Intl` string overload requires `"ES2023.Intl"` in the TypeScript `lib` setting. A malformed amount now throws rather than rendering, so the callers that build money strings must validate them first — which is where that check belongs.
**Revisit when:** A currency needs a scale other than two (for example a per-unit price in a minor unit of 1/1000), which would need a per-currency scale rather than a fixed two.

## D-027 — The application can run against a local PGlite database
**Status:** accepted
**Context:** The seed scripts already understood `PGLITE_PATH`, but the application itself could only start against Neon. A contributor without database credentials could run the test suites but not the application, so the directory and the profile could not be inspected in a browser before Phase 3.
**Decision:** `src/db/client.ts` selects a PGlite instance when `PGLITE_PATH` is set and the Neon Pool otherwise. `DATABASE_URL` becomes optional when `PGLITE_PATH` is present. `@electric-sql/pglite` is added to `serverExternalPackages` in `next.config.ts`, because Turbopack otherwise rewrites PGlite's `path`/`fs` calls into a form Node rejects with `ERR_INVALID_ARG_TYPE`.
**Alternatives considered:** (a) require Neon for local development — keeps one database target but makes every UI change depend on a credential the contributor may not have; (b) use an in-memory PostgreSQL server as a separate process — more moving parts than PGlite, which is already installed for the tests.
**Why:** The application and the test suites now run against the same engine, so what a contributor sees locally is what the integration tests exercise. No schema, migration, or query changed: the same Drizzle schema and the same migrations run in both.
**Consequences:** A local run is `PGLITE_PATH=… pnpm db:migrate && pnpm db:seed && PGLITE_PATH=… pnpm dev`. Production is unaffected and still uses Neon. The PGlite dependency is a development dependency; it is not deployed.
**Revisit when:** The integration tests need a PostgreSQL feature PGlite does not implement — at which point the test target and the development target may have to diverge.

## D-028 — Enum columns are sorted by their text value, not by their enum position
**Status:** accepted
**Context:** PostgreSQL orders an enum by the order its values were declared in the type. `country_code` is declared `US, IN, GB, DE, CA, AU`, so sorting the directory by country put US first and GB near the end. A reader clicking "Country" expects alphabetical order, and the first test written against the seeded cohort failed because of it. The same applies to `employment_status` and `work_mode`.
**Decision:** Every enum sort column is cast to text in the `ORDER BY` clause: `asc(sql`${employees.countryCode}::text`)`. The cast happens in the query, not in the caller, so no caller can forget it.
**Alternatives considered:** (a) sort by the declared enum order — deterministic, but it is not the order a reader expects and it changes whenever the enum is edited; (b) keep a separate text column for sorting — a second source of truth for the same value.
**Why:** The cast is one expression in one place, and it makes the visible order match the label on the column header.
**Consequences:** A reader sorting by country sees `AU, CA, DE, GB, IN, US`. The cast costs nothing at this table size, and the `switch` that maps sort values to columns means a new sort value cannot silently skip the cast.
**Revisit when:** the workforce grows large enough for the sort to need an index — a functional index on `(country_code::text)` would then be worth measuring.

## D-029 — The directory's state lives in the URL, and nothing else
**Status:** accepted
**Context:** The directory needs a search term, five filters, a sort, a page, and a reporting date. Holding them in React state makes the view unshareable, breaks the back button, and loses the state on a refresh. Holding them in a client-side store would need a state library, which the frozen architecture does not include.
**Decision:** The URL query string is the single source of truth for the directory's state. `src/lib/url-state.ts` holds pure functions — `readQueryState`, `buildQueryString`, `applyQueryChange`, `clearFilters`, `hasActiveFilter` — and the server component reads the query string and renders one bounded page. The filters and the sort are links, not scripts, so the directory works without JavaScript and every state is keyboard-accessible.
**Alternatives considered:** (a) React state — unshareable and lost on refresh; (b) a client-side store — a new dependency and a second source of truth for the same state; (c) the URL plus React state — two sources of truth that drift.
**Why:** The URL is already the mechanism the product uses to carry a reporting date (RPT-003), so extending it to the rest of the state keeps one rule rather than two. A pure module also makes the transitions testable without a browser.
**Consequences:** A filter change resets the page to 1 (QRY-006), because a page number is only meaningful relative to the result set that produced it. The URL is longer, which is the visible cost.
**Revisit when:** a filter needs a value that does not fit a query string — a saved search, for example — which would need a server-side saved-search store.

## D-030 — A page beyond the last page states so, and offers a way back
**Status:** accepted
**Context:** QRY-004 requires a page number beyond the last page to return an empty result with a safe navigation affordance, never an error. The first implementation fell through to the empty-state branch and told the reader "There are no employees to show — the workforce has not been loaded yet", which is a plain falsehood: the workforce was loaded and the filters matched, only the page number was out of range.
**Decision:** The page distinguishes three empty cases. No rows **and** no filter means no data. No rows with a filter or a search means no match. No rows but a positive total means the page is past the end of the results, which is stated in those words, and the pager is still rendered. The pager drops the row range when it would run past the total, states the total alone, and its back link goes to the last page that has results rather than to the previous page number, which is also empty.
**Alternatives considered:** (a) clamp the page number to the last page — silent, and it makes the reader's URL disagree with what is shown; (b) show a 404 — a page number is not a missing resource; (c) return an error — forbidden by QRY-004.
**Why:** Each of the three cases needs a different response, and a reader who is told the wrong one loses trust in the whole directory.
**Consequences:** The pager component takes the total into account when it builds its range, so the out-of-range case is handled once, in one place, and is covered by a test.
**Revisit when:** the directory gains a result-set size large enough for a jump-to-page control, which would give the out-of-range reader a direct route to any page.

## D-031 — The salary sort uses the USD equivalent, and says so
**Status:** accepted
**Context:** The workforce is paid in six currencies. The directory sorted the salary column by `base_salary`, which compares ₹96,05,289 with $74,716 as though they were the same unit. On the seeded cohort the two orderings diverge at the very first row: the local-amount sort put the Indian employees at the top of a "highest salary" list, and the USD-equivalent sort put the American ones there. The order was an artefact of the currency mix, not of the salaries.
**Decision:** The salary sort uses `salary_records.usd_equivalent`, the synthetic amount every record already carries (MON-004). Each row still displays the **local** amount with its own currency code, and the table states the basis of the sort in a note while that sort is active. The directory's query projection now also returns `currentUsdEquivalent`.
**Alternatives considered:** (a) keep sorting by the local amount and label the column as mixed — honest about the data but not useful, because the reader still cannot tell who earns more; (b) sort by the local amount only within a currency and refuse to compare across currencies — correct but not what a single sortable column can express, and it would need a second control; (c) add a reporting-currency column — a schema change for a display concern, when the equivalent already exists.
**Why:** `usd_equivalent` is the one basis every record shares, and the seed populates it for all 22,093 salary rows, so the sort needs no new data and no new policy.
**Consequences:** The sort is comparable across currencies. A reader who wants the local order can filter to one currency. The note under the table is shown only while the salary sort is active, so the common case is not cluttered.
**Revisit when:** the seed stops populating `usd_equivalent` for some records, which would leave the sort with nulls and no total order.


## D-032 — The reporting date is bounded to the past and the present
**Status:** accepted
**Context:** The reporting-date control sets `max` to today, because the product asks "what did this person earn as of this date" and the future is not a meaningful answer. The URL, however, accepted any date. A shared link carrying `?asOf=2030-01-01` rendered a date input that the browser itself reported as invalid — "Value must be 11/13/2026 or earlier" — with no explanation on the page, and the page header cheerfully said "Reporting context: As of 1 Jan 2030".
**Decision:** The reporting date is bounded in two places, so the two can never disagree. `readReportingDate` in `src/lib/url-state.ts` falls back to today for a malformed or future value, and the Zod schema rejects a future date outright, so the query selects the salary for the same date the page displays. The bound lives in the schema as well as the reader because the schema is the boundary where untrusted input arrives.
**Alternatives considered:** (a) allow the future and drop the `max` on the control — the future becomes a legitimate "what will this person earn" question, which is a product decision this repository has not made, and it would need a rule for which scheduled revision applies; (b) clamp the future date to today in the route only — the query would still use the unbounded date, so the table and the header could disagree; (c) show an error for a future date — a hand-edited URL would then produce an error page, which QRY-003 forbids.
**Why:** The fallback keeps the product's existing meaning, keeps the date control valid, and keeps an unknown or hostile value harmless.
**Consequences:** The schema test pins the clock, because "not in the future" is a relation to the current date and its expectations would otherwise change meaning as the real date moves past them.
**Revisit when:** the product decides that a future reporting date should mean "what this person's pay will be", which would need a documented rule for a salary with several future-effective records.


## Decision template
### D-XXX — Title
**Status:** proposed / accepted / superseded
**Context:** What problem forced the decision?
**Decision:** What are we doing?
**Alternatives considered:** What credible alternatives existed?
**Why:** Why is this best now?
**Consequences:** What becomes easier/harder?
**Revisit when:** What evidence would justify changing it?
