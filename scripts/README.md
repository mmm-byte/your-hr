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

## Required tests/checks
Seed count, uniqueness, foreign keys, salary/date/currency invariants, duplicate effective dates, and orphan detection.
