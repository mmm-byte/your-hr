# Your HR

A salary-centered HR management system for a synthetic multinational workforce of **10,000 employees**,
built for an HR Manager who currently manages compensation in spreadsheets.

> **Assessment environment.** This is a public-review engineering assessment. The data is entirely
> synthetic, there is **no authentication layer** (the user is assumed to be an authorised HR Manager),
> and the app is not a certified production HR system. See [docs/SECURITY.md](docs/SECURITY.md).

---

## What it does

Your HR replaces spreadsheet-driven compensation administration with one auditable workspace:

| Capability | What it means |
|---|---|
| **Employee directory** | Find any of 10,000 people with server-side search, filters, sort and pagination. The browser never receives all 10,000 rows. |
| **Employee profile** | Employment context, current compensation as of a chosen reporting date, and the full effective-dated salary history. |
| **Salary revision** | Append a new effective-dated salary record with a required reason, in one transaction with its audit event. History is never overwritten. |
| **Compensation & analytics** | Headcount, median and average pay — always within a single currency, never a blended total. |
| **Data quality** | A deterministic work queue that surfaces currency mismatches, inconsistent records, and history anomalies. |

**The core idea:** compensation history is append-only and effective-dated, because overwriting a salary
destroys the truth the product exists to protect.

---

## Stack

```
Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 · shadcn/ui
PostgreSQL (Neon) · Drizzle ORM · Zod
Vitest · Playwright · PGlite (in-process PostgreSQL for tests)
```

One repository, one Next.js application, one PostgreSQL database, one deployment. No second datastore,
no separate backend, no cache layer, no auth provider.

---

## Getting started

```bash
pnpm install
cp .env.example .env.local     # add DATABASE_URL
pnpm dev
```

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the local app |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Unit + component tests (no database needed) |
| `pnpm test:integration` | Database integration tests (PGlite, no server needed) |
| `pnpm test:e2e` | End-to-end tests (Playwright) |
| `pnpm db:generate` | Generate a Drizzle migration |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Seed the deterministic 10,000-person cohort |
| `pnpm db:verify` | Verify seed invariants (non-zero exit on failure) |

---

## Repository layout

| Path | Contents |
|---|---|
| `docs/` | Product and technical contracts — requirements, domain rules, data, API, UI, UX journey, testing, security, decisions |
| `docs/DELIVERY-PLAN.md` | Build order, phase gates, verified environment facts, and the Git/GitHub push strategy |
| `docs/UX-JOURNEY.md` | The full user journey: access model, route map, page behaviour, required states |
| `docs/DOMAIN-RULES.md` | Every business rule, identified (`EMP-*`, `MON-*`, `SAL-*`, `ANA-*`, `AUD-*`, …) |
| `docs/DECISIONS.md` | Decision register — what was decided, what was rejected, and when to revisit |
| `src/app/` | Routes, server components, route handlers |
| `src/components/` | shadcn primitives and reusable product components |
| `src/db/` | Drizzle schema, connection, queries, transactions |
| `src/lib/` | Pure domain rules, money/date formatting, error codes |
| `src/schemas/` | Zod boundary contracts |
| `scripts/` | Deterministic seed and verification scripts |
| `tests/` | Unit, integration, component, and E2E suites plus the live test matrix |
| `Dataset/` | Approved synthetic seed inputs and their validation report |

---

## How the work is organized

Each phase ends at a **green gate** — a command set that must be clean before the next phase begins.
`main` is never broken: every commit installs, builds, and passes its tests.

```
Phase 0  Toolchain, CI, global shell, health endpoint
Phase 1  Schema, migrations, deterministic 10k seed
Phase 2  Pure domain core (money, effective dates, analytics, eligibility)
Phase 3  Employee directory and profile
Phase 4  Salary revision — transactional, audited, conflict-aware
Phase 5  Compensation, analytics, data quality
Phase 6  Hardening, measured performance, deployment
```

Full detail, including the verified environment constraints and resolved blockers, is in
[docs/DELIVERY-PLAN.md](docs/DELIVERY-PLAN.md).

---

## Data provenance

All records are synthetic. The country, branch, currency, and salary-localization fields are
**documented deterministic modelling assumptions** added for this assessment — the original source data
was USD-only and did not model countries. The fixed FX reference date is a reproducibility device, not
a live market rate, and the application never presents localized values as market benchmarks.

The seed cohort's invariants were verified before implementation: exactly 10,000 unique employees,
22,093 effective-dated salary records, no duplicate `(employee_id, effective_from)`, no salary before
hire or after termination, no currency/country mismatch, and no orphan records.

See [docs/DATASET.md](docs/DATASET.md).

---

## AI usage

AI was used to accelerate analysis, implementation, and documentation; the engineer owns the
requirements, decisions, and verification. Every consequential session is recorded with what was
accepted, what was rejected, and how it was checked — in [docs/AI-USAGE.md](docs/AI-USAGE.md).
