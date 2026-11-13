# `scripts` — Controlled Operations

## Owns
- deterministic seed/import
- seed verification
- explicit maintenance/benchmark operations

## Rules
- Safe target/environment check before destructive work.
- Idempotent or refuses unsafe rerun.
- Clear summary, non-zero exit on failure.
- No secrets in output.
- No silent data fabrication beyond documented deterministic transforms.
- Scripts are not imported by runtime application code unless explicitly designed as a shared pure module.
- `date` columns are decoded with the shared parser in `src/db/date-parsers.ts`,
  so a script reads the same calendar day the application does (D-021).

## Commands
| Command | Does |
|---|---|
| `pnpm db:migrate` | Applies the committed migrations, skipping files already applied |
| `pnpm db:seed` | Writes the approved cohort; refuses to run against a populated target |
| `pnpm db:verify` | Asserts 29 invariants; exits non-zero on any violation |

Set `PGLITE_PATH` for a local file database, or `DATABASE_URL` for a PostgreSQL server.

## Required tests/checks
Seed count, uniqueness, foreign keys, salary/date/currency invariants, duplicate effective dates, and orphan detection.
