# `tests` — Cross-Layer Verification

## Structure
- `unit/`: pure domain/helper behavior
- `integration/`: PostgreSQL and server boundaries
- `e2e/`: few critical user journeys
- factories/fixtures: deterministic builders only

## Required file header
Every non-trivial test file lists what it covers and what belongs to another test file/layer.

## Rules
- Behavior names, not implementation names.
- Fixed clock and deterministic data.
- No live network/FX/production DB.
- No assertion weakening to satisfy generated code.
- Update `TEST-MATRIX.md` with every capability/rule change.

## Review question
If this test passes while the real requirement is broken, the test is insufficient.
