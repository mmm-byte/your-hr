# Your HR — Agent Operating Contract

> This file governs every AI coding agent and human contributor working in this repository. The nearest nested `AGENTS.md`, if one is intentionally added later, may add stricter local rules but must not weaken this contract.

## 1. Mission
Build a clean, testable, production-minded salary-management application for a 10,000-person synthetic multinational workforce. AI performs implementation work; the engineer remains responsible for product meaning, architecture, correctness, security, and verification.

The assessment values structured thinking, end-to-end functionality, meaningful deterministic tests, maintainability, intentional AI use, artifacts, and incremental commits. Do not optimize for maximum code or maximum feature count.

## 2. Mandatory reading order
Before planning or changing code, read:
1. `docs/REQUIREMENTS.md`
2. `docs/ENVIRONMENT.md`
3. `docs/GLOSSARY.md`
4. `docs/DATASET.md`
5. `docs/DOMAIN-RULES.md`
6. `docs/DATABASE.md`
7. `docs/API-CONTRACT.md`
8. `docs/FEATURES.md`
9. `docs/UI.md`
10. `docs/UX-JOURNEY.md`
11. `docs/TESTING.md`
12. `docs/SECURITY.md`
13. `docs/DELIVERY-PLAN.md`
14. the `README.md` in every folder being changed

If documents conflict, stop. Identify the exact conflict and propose the smallest documentation decision before implementing.

**Non-negotiable boundaries already decided — do not re-litigate or invert them:**
- **No authentication layer.** No login page, session, or auth provider. The persona is the assumed HR Manager; audit events use the fixed `hr-manager` surrogate (D-006, D-011, ACC-001…004).
- **`/` is Overview.** There is no `/overview` route. Follow the route map in `docs/UX-JOURNEY.md` §2 (D-012).
- **Use `drizzle-orm/neon-serverless`, never `neon-http`.** The HTTP driver throws on `db.transaction()`, which would break salary + audit atomicity (D-015, SAL-010).
- **Money is never a JS number.** Keep `numeric` as a string; use `BigInt` minor units for arithmetic (MON-002).
- **Dates are date-only.** Never construct a `Date` from a `YYYY-MM-DD` value — it shifts the calendar day across time zones (RPT-004).
- **Never render a mixed-currency total.** Group by currency, or use an explicitly labelled synthetic USD equivalent (MON-004, RPT-007).
- **Error codes come from the D-017 catalogue.** Never free text.
- **Integration tests run on PGlite**, not a database server (D-009).

## 3. Commands first
Use repository scripts rather than improvised commands. The final repository should expose:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```

Before claiming completion, run the smallest relevant checks plus `pnpm typecheck` and `pnpm lint`. Before merge/release, run the full required CI set.

## 4. Work protocol
For every task:

### A. Understand
- Restate the user outcome, affected domain rules, acceptance criteria, and non-goals.
- Identify related UI, server, database, test, and documentation files.
- Trace existing relationships before editing; do not infer names from memory.

### B. Inspect
- Search for an existing implementation, component, utility, schema, test factory, or pattern.
- Read imports, callers, database relationships, and existing tests.
- Check the nearest folder `README.md`.

### C. Plan
Produce a short implementation plan listing:
- files to modify/create
- data flow
- invariants and failure modes
- tests to add/change
- documentation impact

Do not code until the plan fits the frozen architecture.

### D. Test first where behavior is meaningful
- Add or update the smallest behavioral test that fails for the right reason.
- Implement the minimum production code to pass it.
- Refactor only after green.
- Do not manufacture tests after a large implementation merely to increase coverage.

### E. Verify
- Run related tests.
- Run typecheck/lint.
- Build when routing, server/client boundaries, environment, or deployment behavior changed.
- Run database verification after migrations or seed changes.
- Inspect the actual UI for loading, empty, error, success, keyboard, and narrow-width behavior.

### F. Explain
Summarize:
- what changed
- why
- tests run and their results
- known limitations
- documentation updated

Never say “done” when checks were not run or failed.

## 5. Ponytail / minimal-code discipline
Use the Ponytail philosophy as a **decision ladder**, not as permission to skip correctness:

1. Does this code need to exist?
2. Can an existing product requirement be satisfied without a new feature?
3. Can the language/platform/framework already do it?
4. Does an already-approved dependency do it?
5. Does an existing repository component/function do it?
6. Can a small direct implementation solve it clearly?
7. Only then add the minimum new abstraction or dependency.

Rules:
- YAGNI over speculative architecture.
- Reuse before creation.
- Prefer deletion/simplification over wrappers around wrappers.
- Three similar lines are often better than a premature generic framework.
- Extract only when duplication represents the same stable concept.
- A dependency requires a documented problem, alternatives considered, maintenance/security impact, and approval through `docs/DECISIONS.md`.
- Ponytail is an optional agent skill/tool. The repository contract must remain sufficient even when Ponytail is unavailable.

## 6. Frozen architecture
- One GitHub repository.
- One Next.js TypeScript application.
- One Vercel project.
- One Neon PostgreSQL database/project.
- Drizzle for schema/migrations/data access.
- Zod at external/server boundaries.
- shadcn/ui + Tailwind for UI.
- TanStack Table only for table behavior.
- Recharts only for necessary charts.
- Lucide only for icons.

Never introduce a separate backend, second datastore, cache, queue, state-management framework, auth vendor, API framework, or second UI system without an accepted decision record.

## 7. Dependency and file creation policy
Before creating a file, answer:
- Which requirement owns it?
- Which folder contract permits it?
- Who imports/calls it?
- What test protects it?
- What becomes simpler because it exists?

Before adding a package:
- confirm no built-in or installed solution exists
- confirm its license and maintenance status
- explain bundle/runtime/security consequences
- record the decision when material

Do not add placeholder folders, `utils` dumping grounds, generic base classes, or “future-proof” interfaces with one implementation.

## 8. Code structure and dependency direction
Preferred direction:

```text
UI / route
  -> application operation
    -> domain rule
      -> database/repository
```

Allowed simplification: a server component may call a focused server-side query directly when no domain workflow is involved.

Forbidden:
- client component -> database
- UI component -> Drizzle
- database module -> React/UI
- tests that rely on production database/state
- route handlers containing duplicated business rules
- circular dependencies

Every module should have one clear responsibility and a narrow public surface.

## 9. Relationship comments and documentation
Comments must explain **why, invariant, ownership, or non-obvious relationship**, not narrate syntax.

### Required relationship header for non-trivial modules
Use a short header only when it adds real orientation:

```ts
/**
 * Purpose: Select the employee salary effective on a reporting date.
 * Called by: employee profile and compensation analytics server queries.
 * Reads: salaryRecords via employeeId + effectiveFrom index.
 * Rules: SAL-006, SAL-007, ANA-006.
 * Tests: current-salary.query.test.ts; salary-history.integration.test.ts.
 */
```

Do not copy stale file paths blindly. Update this header in the same change when callers, tables, rules, or tests change.

### Required comments
- reason for a non-obvious business rule
- transaction boundary and rollback expectation
- currency/localization distinction
- security-sensitive handling
- intentional performance optimization supported by measurement
- unusual framework/server-client constraint

### Forbidden comments
```ts
// Increment i
// Call database
// This function gets employee
```

Do not comment every line. Prefer names, types, small functions, tests, and folder documentation. A misleading comment is worse than no comment.

## 10. Traceability requirements
Each substantial behavior must be traceable:

```text
Requirement -> Domain rule -> Schema/query -> UI -> Test
```

Update `docs/TRACEABILITY.md` when adding or changing a major capability.

Identifiers in `docs/DOMAIN-RULES.md` should be referenced in focused tests and, where useful, relationship headers. Do not pepper every line with IDs.

## 11. Testing contract
### Test matrix required for each behavior
Before implementation, classify applicable scenarios:

- happy path
- boundary values
- invalid input
- empty/not-found
- permissions/auth boundary (if applicable)
- historical/effective-date behavior
- currency/money behavior
- concurrency/idempotency
- transaction rollback
- database constraint/integration
- loading/empty/error/success UI states
- keyboard/accessibility
- narrow viewport
- performance risk
- data privacy/security

Mark non-applicable scenarios explicitly in the work note; do not silently forget them.

### Test comments
Each test file starts with a compact coverage header:

```ts
/**
 * Covers:
 * - SAL-005 append-only revision
 * - SAL-006 duplicate effective date conflict
 * - SAL-010 salary + audit atomicity
 *
 * Does not cover:
 * - UI rendering (salary-revision-form.test.tsx)
 * - PostgreSQL unique constraint (salary-records.integration.test.ts)
 */
```

Individual tests use behavior-oriented names. Add comments inside tests only for non-obvious setup or assertion intent.

### Test quality rules
- Test observable behavior, not private implementation details.
- One test may assert multiple outputs when they form one business outcome.
- Avoid snapshots for dynamic business behavior; use narrow snapshots only for stable presentation where justified.
- No real clock, random data, live FX, network, or production database dependency.
- Fix the clock and use deterministic factories.
- Never weaken assertions only to make generated code pass.
- Generated tests require human/agent review for meaningful assertions.
- Coverage reports expose gaps but do not define completeness.

## 12. Testing inventory and gap prevention
Maintain `tests/TEST-MATRIX.md` with one row per capability/rule and links to tests. When behavior changes:
1. update the matrix
2. add/change tests
3. run related tests
4. verify no scenario moved between layers without coverage

A change cannot be called complete if its matrix row has an unexplained gap.

## 13. Database rules
- Drizzle schema + committed migrations are the source of truth.
- Never modify production schema manually through dashboards.
- Migrations are reviewed and applied to development first.
- Seed is deterministic and idempotent or safely refuses unsafe reseeding.
- Never seed automatically on every build/startup.
- Money uses exact database semantics.
- Salary history is append-only through product workflows.
- Multi-step salary mutation + audit is transactional.
- Database errors are mapped to stable application errors; do not expose raw SQL.

## 14. UI rules
- Use existing shadcn primitives before custom primitives.
- Server components by default; add `use client` only where interaction requires it.
- No database access in client components.
- Every data surface has loading, empty, error, and populated states.
- Every mutation has pending, success, validation-error, and unexpected-error behavior.
- Use centralized money/date/status formatting.
- Do not load all 10,000 employees into the browser.
- Server-side sorting/filtering/pagination.
- No status conveyed only through color.
- Keyboard and responsive behavior are part of acceptance, not polish.

## 15. Security and privacy
- Never commit or print secrets.
- Never put secrets in `NEXT_PUBLIC_*`.
- Treat synthetic salary data as sensitive by design.
- Validate untrusted input on the server.
- Allow-list query sort/group fields.
- Never execute AI-generated SQL.
- Never log entire requests, salary histories, or employee records.
- Exports neutralize spreadsheet formula injection.
- User errors are safe; server logs may use correlation IDs.

## 16. Git and change discipline
- Small, coherent commits that show evolution.
- Do not rewrite history to fabricate TDD.
- Do not mix broad refactor, dependency upgrade, formatting, and feature behavior in one commit.
- Do not commit generated caches, `.env*`, `.vercel`, test artifacts, or secrets.
- Document material architecture/domain changes in the same commit.

## 17. Refactoring rules
Refactor when:
- tests are green
- duplication represents the same concept
- names/ownership are unclear
- dependency direction is violated
- a file has more than one reason to change

Do not refactor unrelated areas in a feature task. Do not create abstractions because a pattern might appear later.

## 18. Stop conditions
Stop and raise the issue instead of guessing when:
- requirements/docs conflict
- a migration may destroy data
- preview is connected to production for destructive testing
- a secret is discovered in source/history
- external API/live FX would be required
- a new service/package materially changes architecture
- tests fail for an unexplained reason
- the task requires real employee data

## 19. Definition of done
- requirement and domain rule satisfied
- smallest reasonable change
- relationship documentation updated
- test matrix updated
- relevant tests added and passing
- typecheck/lint pass
- build passes when affected
- database verify passes when affected
- UI states/accessibility/responsiveness inspected when affected
- no secret or architectural drift
- AI usage/decision docs updated when consequential
- summary is truthful about checks and limitations

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
