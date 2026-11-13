# Your HR — Environment & AI Operating Guide

Minimal full-stack foundation for the Incubyte Salary Management Engineering Assessment

Audience: developer, AI coding agents, and reviewers

## 1. Purpose and non-negotiable direction

This document is the operating contract for the project environment. Humans and AI agents should read it before changing infrastructure, installing dependencies, altering database connectivity, or changing deployment behavior.

- Optimize for a reviewable assessment, not an enterprise platform.
- Keep the architecture deliberately small so engineering effort goes into salary-management behavior, data correctness, testing, and UX.
- The production application must be reachable through a stable Vercel deployment and use PostgreSQL through the existing Neon integration.
- Never trade reproducibility for convenience: schema changes use migrations; seed behavior is deterministic; secrets never enter source control.
## 2. Frozen environment architecture

## 3. Environment boundaries

Vercel documents Local, Preview, and Production as its three default environments, each with its own environment-variable scope. Neon documents that its managed Vercel integrations support preview database branching. See References.

## 4. Environment variables and secrets

- Never commit .env, .env.local, Vercel tokens, connection strings, passwords, or copied dashboard screenshots containing credentials.
- Keep .env.example free of real secrets. It lists variable names plus safe descriptions/placeholders only.
- After an environment-variable change, use a new deployment so the deployment receives the intended values.
- AI agents must not print full secret values into terminals, test output, documentation, issues, prompts, or commit messages.
## 5. One-time setup sequence before feature coding

1. Create one GitHub repository for the assessment. Keep it private during development if desired; ensure reviewers can access it at submission time.
1. Create the Next.js + TypeScript application locally and make the first small commit.
1. Import that repository into one Vercel project. Confirm the framework is detected as Next.js and main is the production branch.
1. Attach the already-created Neon Postgres resource to that Vercel project. Confirm the project receives the expected database environment variables.
1. Link the local directory to Vercel and pull Development environment values into .env.local.
1. Create the initial Drizzle schema and migration. Do not create application tables manually in dashboards once migrations become the source of truth.
1. Create a minimal database connectivity health check that returns only safe status information.
1. Deploy the empty foundation and verify its public URL before building product features.
1. Only after the foundation works, implement the deterministic data seed/import and then feature work.
## 6. Repository contract

## 7. AI agent operating contract

- Do not introduce a package, hosted service, architectural layer, route pattern, database, or state-management library without a concrete requirement and documented justification.
- Prefer an existing shadcn/ui primitive before writing a button, input, card, dialog, dropdown, table shell, badge, tooltip, or toast from scratch.
- Keep server-only code server-only. Database access never belongs in a client component.
- Validate external/user input at the server boundary. Client validation improves UX but never replaces server validation.
- Use database transactions for multi-step writes that must succeed or fail together.
- Do not mutate historical salary records to represent a new salary. Add a new effective-dated record according to domain rules.
- Never silently convert currencies. Any conversion or comparison policy must be explicit and traceable.
- Never fabricate missing dataset values at runtime. Synthetic extensions belong in the deterministic seed/data-generation process and must be documented.
- Implement loading, empty, error, and success states for user-visible data flows.
- Run the relevant quality commands before claiming a work item is done; report failures honestly.
## 8. Frontend guardrails

## 9. Database and data safety rules

- Drizzle schema + committed migrations are the schema source of truth.
- A migration must be forward-safe and reviewed before production application.
- Seed scripts must be deterministic and idempotent or explicitly refuse to re-seed unsafe state.
- Do not automatically seed production during every Vercel build or application startup.
- Keep one employee identity key consistently across imported employee, salary, absence, performance, and attrition records.
- Money should use an exact numeric representation in PostgreSQL. Avoid JavaScript floating-point arithmetic for authoritative money calculations.
- Create database constraints/indexes for rules that are truly database invariants, including unique identifiers and common relationship keys.
- Back up/export the synthetic production dataset before destructive migration experiments.
## 10. Deployment edge cases and prevention

## 11. Required developer commands

The exact scripts may be finalized with the repository, but the project should expose one predictable command per responsibility:

## 12. Environment readiness gate

- ☐ GitHub repository exists and the first incremental commits are visible.
- ☐ Local Next.js application starts without secret values in source code.
- ☐ One Vercel project is linked to the repository.
- ☐ Existing Neon database is attached to that project.
- ☐ Development, Preview, and Production environment-variable scopes are understood and intentionally configured.
- ☐ .env* secret files and .vercel local metadata are excluded from source control.
- ☐ Database migration succeeds in the intended development environment.
- ☐ Health verification confirms application and database connectivity without leaking internals.
- ☐ Public production deployment opens successfully.
- ☐ No feature coding begins until the above foundation is reproducible.
## 13. Reviewer-facing explanation

The project deliberately uses a minimal architecture: a single Next.js codebase deployed to Vercel and a single Neon PostgreSQL database. This choice minimizes orchestration overhead for a take-home assessment while preserving relational integrity, deployability, preview review, incremental Git history, and a clear place for tests and documentation. Additional services are intentionally excluded until a requirement demonstrates their value.

## 14. References and evidence basis

Vercel Environments: Vercel documents Local, Preview, and Production as default environments and describes preview deployments. https://vercel.com/docs/deployments/environments

Vercel Environment Variables Across Environments: Vercel documents environment-scoped variables and local pull workflows. https://vercel.com/docs/environment-variables/manage-across-environments

Neon + Vercel Integration Overview: Neon compares Vercel-managed, Neon-managed, and manual integration approaches and preview branching availability. https://neon.com/docs/guides/vercel-overview

Neon-Managed Vercel Integration: Neon documents isolated database branches for preview deployments for this integration. https://neon.com/docs/guides/neon-managed-vercel-integration

Microsoft Word Support: Document prepared as a reviewable Word artifact; Word supports headings, tables, review, collaboration, and accessibility checking. https://support.microsoft.com/word


## Structured reference tables

> **Principle**  One repository, one Next.js application, one PostgreSQL database, one deployment platform. Add another service only when a documented requirement cannot reasonably be met inside this boundary.

| Concern | Decision | Reason |
| --- | --- | --- |
| Source control | One GitHub repository | Preserves incremental history and gives Vercel a single deployment source. |
| Application | One Next.js application, TypeScript strict | UI, server rendering, server operations, and database access stay in one codebase. |
| Deployment | One Vercel project | Production and preview deployments are managed in one place. |
| Database | One Neon PostgreSQL project | Relational data model fits employees and history; no second database. |
| UI system | Tailwind + shadcn/ui | Reuse consistent primitives instead of hand-building controls. |
| Data access | Drizzle ORM | One schema and migration path. |
| Validation | Zod | One validation vocabulary at application boundaries. |
| Tables | TanStack Table only where needed | Employee datasets need sorting/filtering/pagination without adding a second UI framework. |
| Charts | Recharts only where a chart adds decision value | Do not add multiple chart packages. |
| Icons | Lucide | One icon language. |

> **Do not add**  A separate backend app, Supabase/Firebase, Redis, MongoDB, a second Vercel project, Redux/Zustand, GraphQL/tRPC, or an authentication vendor unless a later documented requirement justifies it.

| Environment | Purpose | Database rule | Deployment rule |
| --- | --- | --- | --- |
| Local / Development | Daily coding and tests | Development database/branch only. Never use production credentials for destructive work. | Run locally; pull only Development-scoped variables. |
| Preview | Review branch or pull-request changes | Prefer an isolated Neon preview branch where the chosen integration supplies it. | Non-production URL; never treat as final submission URL. |
| Production | Reviewer-facing application | Production branch/database only. Seed deliberately, never on every request/build. | main branch is the production source of truth. |

| Variable | Required | Scope | Rule |
| --- | --- | --- | --- |
| DATABASE_URL | Yes | Development, Preview, Production | Server-only. Never expose through NEXT_PUBLIC_*. |
| DATABASE_URL_UNPOOLED | Only if the chosen migration workflow needs it | As required | Server-only. Use only when the Neon/Vercel integration provides or the migration tool requires it. |
| NEXT_PUBLIC_APP_URL | Optional | Per environment | May be public; use only if application behavior genuinely needs an absolute public origin. |

| Path | Responsibility |
| --- | --- |
| src/app/ | Routes, pages, server components, route handlers/server actions when needed. |
| src/components/ui/ | shadcn-generated UI primitives. Do not casually rewrite them. |
| src/components/ | Product-specific reusable presentation components. |
| src/db/ | Drizzle connection, schema, and database-level helpers. |
| src/lib/ | Small shared utilities; no dumping-ground logic. |
| src/schemas/ | Shared Zod schemas/contracts when domain boundaries require them. |
| scripts/ | Seed, verification, and one-off controlled data operations. |
| drizzle/ | Generated migrations committed to Git. |
| docs/ | Requirements, domain/data decisions, architecture and AI usage. |
| AGENTS.md | Short mandatory instructions for every AI coding agent. |

> **Mandatory first action**  Before changing code, read REQUIREMENTS.md, this environment guide, DATASET.md, DATABASE.md, DOMAIN-RULES.md, UI.md, and AGENTS.md. If two documents conflict, stop and surface the conflict instead of guessing.

| Area | Required direction |
| --- | --- |
| Design system | Use shadcn/ui + Tailwind only. Keep one restrained enterprise visual language. |
| Icons | Lucide only; no emoji as interface icons and no mixed icon packs. |
| Tables | Server-side query strategy for large employee lists. Do not render all 10,000 rows at once. |
| Money | Render through one MoneyDisplay utility/component using currency metadata; never hand-concatenate symbols. |
| Dates | Use one formatting convention and explicit timezone assumptions where time-of-day matters. |
| Responsive behavior | Primary workflows must remain usable on narrow widths; tables may adapt through column priority rather than tiny text. |
| Accessibility | Labels for controls, keyboard-operable flows, meaningful headings, visible focus, sufficient contrast, status not communicated by color alone. |
| States | Every data surface defines loading, empty, error, and populated behavior. |

| Risk | Preventive rule / response |
| --- | --- |
| Preview writes to production | Use an isolated preview branch/database when available; otherwise disable destructive preview workflows. |
| Environment variable missing | Application start/build or health verification should fail clearly; never fall back to a hard-coded credential. |
| Secret committed | Treat as compromised: rotate credential, remove it from current files, and follow Git history-remediation practices. |
| Migration fails | Stop release; do not seed or continue feature initialization on a partially migrated schema. |
| Seed run twice | Seed is idempotent or detects an already-seeded dataset and exits safely. |
| Database cold start/unavailable | UI returns a controlled service-error state. Do not show raw stack traces to reviewers. |
| Deployment succeeds but DB fails | Health/smoke verification must test database connectivity separately from HTTP availability. |
| Large table becomes slow | Use database-side pagination/filtering/sorting and supporting indexes; verify representative queries. |
| Production URL changes | README contains the canonical reviewer URL, not a temporary commit preview URL. |
| AI changes architecture | PR/commit must update the relevant decision document. Undocumented architectural changes are rejected. |

| Command intent | Recommended script name |
| --- | --- |
| Start local app | pnpm dev |
| Production build | pnpm build |
| Lint | pnpm lint |
| Type check | pnpm typecheck |
| Unit tests | pnpm test |
| End-to-end tests | pnpm test:e2e |
| Generate migration | pnpm db:generate |
| Apply migration | pnpm db:migrate |
| Seed approved dataset | pnpm db:seed |
| Verify seeded invariants | pnpm db:verify |
