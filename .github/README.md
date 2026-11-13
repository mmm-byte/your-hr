# `.github` — Repository Automation and Agent Instructions

## Owns
- CI workflows
- pull-request templates
- repository-wide/path-specific Copilot instructions

## CI principle
CI must run deterministic checks and never mutate production data.

## Agent instruction hierarchy
- root `AGENTS.md`: primary contract
- `.github/copilot-instructions.md`: concise Copilot entry point
- folder `README.md`: local ownership and testing contract
- optional nested `AGENTS.md`: only when stricter local rules are truly needed

Do not create conflicting instruction copies. Update the canonical root contract first.
