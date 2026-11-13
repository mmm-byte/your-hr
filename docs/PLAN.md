# Your HR — Delivery Plan

## Operating principle
Ship a thin complete path early, then deepen it. Every phase should end in a coherent commit/deployable state. Do not build all database code, then all backend code, then all UI code in giant batches.

> **Execution detail:** this file is the phase overview. `DELIVERY-PLAN.md` holds the verified environment
> facts, the gate each phase must pass, the exact commands, and the resolved blockers. Use it when
> executing a phase; use this file to see the whole arc.

## Phase 0 — Product and environment
Artifacts: REQUIREMENTS, DATASET, DOMAIN-RULES, DATABASE, FEATURES, UI, TESTING, ENVIRONMENT, DECISIONS.
Exit: scope and boundaries are understandable without code. **Complete.**

## Phase 1 — Application foundation
- Next.js/TypeScript project.
- shadcn/Tailwind baseline.
- Drizzle + Neon connectivity.
- environment validation.
- health endpoint/check.
- CI: lint, typecheck, tests, build.
- Vercel production starter deployment.
Exit: empty product reliably deploys.

## Phase 2 — Schema + deterministic seed
TDD/verification first for core constraints.
- departments/branches/employees/salary/history/supporting/audit schema.
- migrations.
- seed approved 10,000-person dataset.
- `db:verify` invariants.
Exit: reproducible database with verified relationships.

## Phase 3 — Employee directory vertical slice
- server query/search/filter/sort/pagination.
- directory UI states.
- profile basic employment overview.
- integration + E2E search/profile path.
Exit: reviewer can find and understand an employee.

## Phase 4 — Compensation read model
- current salary determination.
- salary history query.
- currency-safe display.
- profile compensation experience.
- tests for effective dates/currencies.
Exit: compensation truth is inspectable.

## Phase 5 — Salary revision
Red/green/refactor in small increments:
- request validation
- business rules
- transaction + audit
- concurrency handling
- form and states
- E2E happy and conflict/invalid paths
Exit: primary product mutation is robust.

## Phase 6 — Compensation + analytics
- filterable compensation view
- country/branch/department/level metrics
- median/average correctness
- currency/reporting semantics
- a few useful charts
Exit: HR can answer core pay questions without a custom BI tool.

## Phase 7 — Data quality + supporting HR context
- anomalies/work queue
- absences, performance, attrition context on profile
- ensure supporting data never auto-decides compensation
Exit: system handles imperfect/complex workforce context.

## Phase 8 — Hardening
- accessibility keyboard pass
- responsive pass
- security/logging review
- query/index measurement
- empty/error/loading states review
- production smoke checks
- README/screenshots/demo script
Exit: assessment is reviewable end-to-end.

## Suggested commit rhythm
Examples, not a quota:
- `docs: define product scope and domain rules`
- `chore: establish Next.js and deployment foundation`
- `test: specify employee and salary invariants`
- `feat: add initial relational schema`
- `feat: seed deterministic 10k workforce`
- `test: specify directory query behavior`
- `feat: add employee directory vertical slice`
- `test: specify current salary selection`
- `feat: show compensation history`
- `test: specify salary revision rules`
- `feat: revise salary transactionally with audit`
- `feat: add compensation analytics`
- `feat: surface data quality issues`
- `perf: measure representative queries`
- `docs: finalize AI usage, tradeoffs and demo`

Do not manufacture TDD commits after the fact. Commits should truthfully reflect work evolution.
