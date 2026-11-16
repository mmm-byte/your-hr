# `src/server` — Application Operations

## Owns
- the application operation behind a mutation
- the `'use server'` action boundary
- the client-safe result types a form renders

## Does not own
- the schema or the connection (`src/db`)
- the request shape (`src/schemas`)
- the presentation (`src/components`)

## Direction
UI -> server action -> application operation -> domain rule -> database.

The three modules are separate on purpose: a `'use server'` module may export **only async
functions**, so the action cannot also hold the operation, and the client form must not import
a module that reaches the database.

## Modules
| Module | Owns | Rules |
|---|---|---|
| `salary-revision.ts` | `applySalaryRevision` — the version check, the domain rules, the write, and the mapping of every failure to a D-017 code | SAL-002…011, ELG-001…005, CON-001…003, AUD-001…004 |
| `revise-salary-action.ts` | `reviseSalary` — the `'use server'` action the form posts to | SAL-010, AUD-001, CON-001, D-017 |
| `revision-outcome.ts` | `RevisionOutcome` — the result types, in a module with no database import | D-017, CON-002 |

## Rules
- **The operation never throws.** A failure is a result the form can render, carrying a code
  from the D-017 catalogue and a correlation id (AUD-004).
- **The version check runs before the domain rules.** A stale submission means the reader is
  looking at a form that no longer describes the employee's compensation, so every other rule
  would be judged against a state that has already moved on (CON-001).
- **A failure carries the reader's input back.** A refused revision is a pause, not a retype
  (CON-002, D-035).
- **The client imports only `revision-outcome.ts`.** The other two modules reach the database,
  and importing them into a client component would put the database in the browser bundle.

## Tests
`tests/integration/salary-revision-action.test.ts` covers the action's boundary — the codes it
returns, the rules it enforces, and the fact that no raw database message escapes.
`tests/integration/salary-revision.test.ts` covers the transaction underneath it.
