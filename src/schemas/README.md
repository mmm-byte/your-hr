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
| `salary-revision.ts` | The salary revision submission: the money, the percentage, the effective date, the reason, and the expected version | SAL-009, ELG-002/003, ELG-004, CON-001 |

## The revision boundary
The revision schema is the one place an untrusted submission becomes a domain object, so it
carries three rules of its own:

- **The money is a decimal string and is never coerced.** `100.123` is a failure with a
  message beside the field, not a silent truncation to `100.12` (MON-002, D-026).
- **A malformed `expectedVersion` fails the whole submission**, because the version is the
  optimistic-concurrency token: a reader whose token is unreadable is looking at a form that
  no longer describes the employee's compensation, and the message says so (CON-001).
- **The currency is submitted and compared, not adopted.** The employee's currency comes from
  their branch policy, so a submission that names a different one is refused rather than
  silently corrected (ELG-004).

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
