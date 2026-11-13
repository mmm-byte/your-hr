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

## Decision template
### D-XXX — Title
**Status:** proposed / accepted / superseded
**Context:** What problem forced the decision?
**Decision:** What are we doing?
**Alternatives considered:** What credible alternatives existed?
**Why:** Why is this best now?
**Consequences:** What becomes easier/harder?
**Revisit when:** What evidence would justify changing it?
