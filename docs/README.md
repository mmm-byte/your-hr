# `docs` — Product and Technical Contracts

## Purpose
The canonical requirement, domain, data, API, UI, testing, and security contracts for Your HR. These documents define product meaning and engineering constraints; code must be traceable to them.

## Rules
- Update the owning document when behavior, contracts, or decisions change.
- Do not duplicate a rule in two places; reference the canonical identifier (for example `SAL-007`).
- If two documents conflict, stop and surface the conflict before implementing.
- Keep deliberate exclusions visible rather than quietly dropping them.

## Contents
- `REQUIREMENTS.md` — product intent, MVP scope, deliberate exclusions
- `ENVIRONMENT.md` — environment boundaries, variables, deployment rules
- `GLOSSARY.md` — canonical product vocabulary
- `DATASET.md` — seed data meaning and invariants
- `DOMAIN-RULES.md` — rule identifiers (EMP/MON/SAL/ABS/PERF/ATT/ANA/AUD)
- `DATABASE.md` — schema, constraints, and data-access policy
- `API-CONTRACT.md` — server query and mutation contracts
- `FEATURES.md` — priority model and feature acceptance
- `UI.md` — navigation, components, states, accessibility
- `TESTING.md` — test layers and edge-case catalogue
- `SECURITY.md` — threat scenarios and controls
- `DECISIONS.md` — decision register
- `PLAN.md` — phased delivery plan
- `DELIVERY-PLAN.md` — execution plan: verified environment facts, phase gates, commands, resolved blockers
- `UX-JOURNEY.md` — end-to-end user journey: access model, route map, page-by-page behaviour and states
- `PERFORMANCE.md` — measurement plan and record
- `TRACEABILITY.md` — requirement-to-test matrix
- `AI-USAGE.md` — record of consequential AI collaboration
- `OPEN-QUESTIONS.md` — open questions and working assumptions
- `DEMO-SCRIPT.md` — reviewer walkthrough script

## Relationships
Domain rules are referenced by schema, queries, UI, and tests via `docs/TRACEABILITY.md` and `tests/TEST-MATRIX.md`.
