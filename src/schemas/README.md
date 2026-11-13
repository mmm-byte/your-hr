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
