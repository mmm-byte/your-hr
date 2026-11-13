# `src/schemas` — Boundary Contracts

## Owns
Zod schemas for untrusted input and stable server boundaries.

## Rules
- Schema names use glossary terms.
- Server validation is authoritative; client reuse is optional UX.
- Distinguish parsing/shape validation from domain rules requiring database/history context.
- Do not silently coerce ambiguous money/currency/date values.
- Error messages are safe and actionable.

## Tests
Boundary, malformed, missing, extra/untrusted, and precision cases. Domain-context cases belong to domain/application tests.

## Modules
| Module | Owns | Rules |
|---|---|---|
| `query-params.ts` | The shared primitives: integer/string readers, the bounded page size, the allow-list filters | QRY-003, QRY-004, QRY-005 |
| `employee-directory.ts` | The employee directory request | QRY-001…005, ANA-007, RPT-003, RPT-004 |
| `compensation-analytics.ts` | The compensation and analytics request | ANA-001, ANA-005, ANA-007, QRY-003, QRY-005 |

## Conventions
- **No coercion.** `z.coerce.number()` turns `true` into `1` and `[]` into `0`, so a
  malformed parameter would quietly become a valid filter value. The preprocessors return
  `undefined` for anything they do not understand, and the schema's `.catch()` applies the
  documented default (D-025).
- **An unknown value is ignored, not an error.** Every field ends in `.catch(...)`, so
  `safeParse` fails only when the input is not a query object at all. A hand-edited URL
  produces a usable page.
- **A page size above the cap is clamped**, never rejected — default 25, cap 100
  (QRY-004, `docs/PERFORMANCE.md`).
- **Allow-lists come from `@/lib/domain-values`**, which is also the source of the
  PostgreSQL enum types. A filter value the database column cannot hold is rejected
  before the query is built (D-024).
- **No `server-only` import.** This folder is imported by route handlers and by the
  server actions; `server-only` throws outside a React Server Component.
- **No database import.** The schemas validate shape; they never know what the database
  holds.
