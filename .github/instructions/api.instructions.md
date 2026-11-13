---
applyTo: "src/app/api/**/*.ts,src/app/**/route.ts,src/schemas/**/*.ts"
---
# Your HR API and Boundary Instructions

Read `/AGENTS.md`, `/docs/API-CONTRACT.md`, `/docs/GLOSSARY.md`, `/docs/DECISIONS.md`, `/docs/SECURITY.md`, and `/docs/UX-JOURNEY.md` first.

## API restraint
Create a route handler only when an HTTP contract is genuinely needed, such as health, export, or an external integration. Internal pages may use focused server queries/actions directly.

## Contract
- Use canonical glossary terms.
- Validate path, query, and body input with Zod.
- Allow-list sort/group fields and cap page sizes/input lengths.
- Return intentional response DTOs, never raw Drizzle rows.
- Every money value includes currency and clearly distinguishes local vs reporting equivalent.
- Use stable error codes plus safe messages and optional correlation ID.
- Use accurate HTTP semantics: validation, not found, conflict, and unexpected failure remain distinguishable.
- Health output is minimal and never includes hostnames, database versions, credentials, or stack traces.
- CSV export neutralizes values beginning with `=`, `+`, `-`, or `@` and applies current validated filters.

## Stable error codes (D-017 — binding)
`error.code` MUST come from the catalogue in `docs/DECISIONS.md` D-017. It is never free text.
The UI maps the same codes to specific recovery actions, so the codes are part of the public contract.

| Code | HTTP |
|---|---|
| `VALIDATION_ERROR` | 400 |
| `SALARY_EFFECTIVE_DATE_CONFLICT` | 409 |
| `SALARY_VERSION_CONFLICT` | 409 |
| `SALARY_NOT_ELIGIBLE` | 422 |
| `EMPLOYEE_NOT_FOUND` | 404 |
| `NOT_FOUND` | 404 |
| `INVALID_FILTER` | 400 |
| `EXPORT_NOT_AVAILABLE` | 501 |
| `INTERNAL_ERROR` | 500 |
| `DATABASE_UNAVAILABLE` | 503 |

## Mutation safety
- Revalidate on the server.
- Prevent duplicate submissions/idempotency problems as appropriate.
- Salary revisions enforce effective-date, employment, currency, concurrency, and transaction rules.
- **Eligibility (D-014):** only `active`/`on_leave` employees may be revised. Terminated employees are rejected with `SALARY_NOT_ELIGIBLE`. The effective date must fall between hire date and termination date. Currency is fixed by the employee's modelled policy and a submitted mismatch is rejected, never silently overridden.
- **Concurrency (CON-001):** the request carries the `expectedVersion` shown to the user. A mismatch returns `SALARY_VERSION_CONFLICT` and writes nothing.
- **Atomicity (SAL-010):** the salary record and its audit event are written in one transaction.
- Never accept arbitrary SQL, column names, or generated query text from clients/AI.

## Search safety (QRY-002)
Search input is literal text. `%`, `_`, `'`, and `\` must be escaped so they match as characters, never as SQL wildcards or escape sequences.

## Testing
Contract tests cover malformed/missing/extra inputs, limits, not-found, conflict, safe 500 output, content type, export injection, and successful response shape. Every D-017 code has a test asserting its HTTP status and safe message.
