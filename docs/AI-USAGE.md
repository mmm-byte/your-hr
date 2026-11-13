# Your HR — AI Usage Record

## Purpose
The assessment asks for intentional AI use. This file records consequential AI collaboration so reviewers can distinguish acceleration from delegated judgment.

## Working principle
AI proposes; the engineer owns the requirement, decision, verification, and final code.

## What to record
Record sessions that materially affect:
- product scope
- schema/domain rules
- architecture/dependencies
- security/performance decisions
- complex implementation/refactoring
- test strategy
- significant bug diagnosis

Do not dump every autocomplete or trivial prompt.

## Session template
### AI-XXX — Short title
**Date:** YYYY-MM-DD
**Task:** What outcome was requested?
**Context supplied:** Which docs/code/tests were given?
**AI suggestion:** Short factual summary.
**Engineer decision:** accepted / modified / rejected.
**Reason:** Why?
**Verification:** tests, query result, build, manual check, source/document review.
**Artifacts/commit:** paths or commit hash when available.

## Quality examples
Strong entry:
> AI suggested storing only current salary on employees. Rejected because it destroys compensation history. Chose effective-dated salary records; verified with domain tests for current-as-of-date and historical preservation.

Weak entry:
> Asked AI to build the app. It worked.

## Rules for AI-generated work
- Never accept generated code because it compiles.
- Agents read repository contracts before edits.
- External factual/technical claims are checked against current authoritative documentation where material.
- New dependency/service requires explicit justification.
- AI must not receive real HR/salary/customer secrets.
- Generated tests must demonstrate meaningful behavior, not merely mirror implementation.

## Review questions
- What did AI make faster?
- Where was AI wrong or incomplete?
- Which suggestions were rejected and why?
- What was verified independently?
- Did AI change architecture/scope, and was that documented?
