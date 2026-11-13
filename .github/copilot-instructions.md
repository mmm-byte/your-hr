# Your HR — Copilot Repository Instructions

You are working on Your HR, a salary-centered HR management system for a synthetic multinational workforce of 10,000 employees.

Your goal is not to generate the most code.

Your goal is to make the smallest correct, maintainable, testable change that satisfies the documented requirement.

---

## 1. Read before changing code

Before implementation, read:

1. `/AGENTS.md`
2. `/docs/REQUIREMENTS.md`
3. `/docs/ENVIRONMENT.md`
4. `/docs/GLOSSARY.md`
5. `/docs/DATASET.md`
6. `/docs/DOMAIN-RULES.md`
7. `/docs/DATABASE.md`
8. `/docs/API-CONTRACT.md`
9. `/docs/FEATURES.md`
10. `/docs/UI.md`
11. `/docs/TESTING.md`
12. `/docs/SECURITY.md`

Also read the nearest `README.md` for every folder you modify.

**Read `docs/UX-JOURNEY.md` before building any page or interaction.** It defines the access model
(no login — see D-006/ACC-001), the canonical route map (D-012), the reporting-date contract
(RPT-001…004), and the required state set for every data surface. `docs/DELIVERY-PLAN.md` holds the
verified environment facts and the phase gates.

Do not invent requirements when documentation already defines the behavior.

If two documents conflict, stop and surface the conflict before coding.

---

## 2. Follow the existing architecture

The architecture is deliberately minimal:

GitHub
→ Vercel
→ Next.js + TypeScript
→ Neon PostgreSQL

Approved application tools:

- Next.js
- TypeScript strict mode
- PostgreSQL / Neon
- Drizzle
- Zod
- Tailwind CSS
- shadcn/ui
- TanStack Table
- Recharts
- Lucide
- approved test tooling already installed

Do not introduce:

- a separate backend
- another database
- Redis
- Firebase
- Supabase
- Redux
- Zustand
- GraphQL
- tRPC
- another UI framework
- another icon system
- another chart library
- an authentication provider
- queues or event infrastructure

unless a requirement genuinely needs it and the decision is recorded in `docs/DECISIONS.md`.

---

## 3. Use the minimal-code decision ladder

Before writing new code, ask in this order:

1. Does this need to exist?
2. Does the repository already solve it?
3. Can the language or standard library solve it?
4. Can Next.js, React, PostgreSQL, or the browser solve it?
5. Can an already-approved dependency solve it?
6. Can the existing component/domain pattern solve it?
7. Can a small direct implementation solve it?
8. Only then create the minimum new abstraction.

Prefer reuse over creation.

Prefer simple code over speculative abstractions.

Do not future-proof against requirements that do not exist.

Do not create a generic framework for one use case.

Do not add a dependency to save a few lines of understandable code.

---

## 4. Trace relationships before editing

Before modifying a non-trivial module, identify:

- who calls it
- what it calls
- what database tables it reads/writes
- which domain rules apply
- which UI surface depends on it
- which tests protect it
- which documentation describes it

Never change a schema field, contract, exported type, shared component, route, or business rule without checking its consumers.

Do not guess relationships from filenames.

Search the repository.

---

## 5. Document important relationships in code

For non-trivial modules, use a short relationship header when it improves understanding:

```ts
/**
 * Purpose: Select the salary effective for an employee on a reporting date.
 * Called by: employee profile and compensation analytics.
 * Reads: salaryRecords using employeeId + effectiveFrom.
 * Rules: SAL-006, SAL-007, ANA-006.
 * Tests: current-salary.query.test.ts and salary-history.integration.test.ts.
 */