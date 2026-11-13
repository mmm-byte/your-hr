# Your HR — Open Questions & Assumptions

## External clarifications worth asking
Only questions that materially change the domain should be sent to the assessment owner:
1. Does "salary" mean annual base salary only, or is total compensation (bonus/allowances) expected?
2. For multiple countries, should reporting remain in local currencies, or is a normalized reporting currency expected?
3. Does "answer questions about how the org pays people" mean filterable analytics/reporting, or is natural-language Q&A an expected requirement?

> **Update after the UX audit.** Questions 2 and 3 are now answered by existing decisions and are no
> longer open: reporting stays in local currencies with a separate, explicitly labelled synthetic USD
> equivalent (D-005, RPT-007), and filterable analytics satisfies the "answer questions" requirement
> (D-001). Question 1 remains genuinely open, but the working assumption below is sound and documented.
>
> **New question worth raising with the owner (Phase 1):** the supplied dataset has no per-row absence
> or review history — only aggregates and a latest snapshot. D-018 resolves this by seeding summaries
> and never fabricating dated events. If the owner expected true absence/review history, the source
> dataset would need to be extended.

## Working assumptions until answered
- Base salary is the primary managed amount; seeded bonus percentage is supporting compensation context.
- Local currency is authoritative for employee display; USD-equivalent is a synthetic reporting field with explicit provenance.
- Dashboards/filterable analytics satisfy the "answer questions" requirement; natural-language Q&A is P2 only.
- HR Manager is already authenticated — the MVP has no authentication layer, and the application says so on every page (ACC-002, D-011).
- Salary history is required because management without history would destroy prior compensation truth.
- Supporting absence/performance/attrition data provides context but does not automatically drive pay decisions.
- Absence and performance are seeded **summaries**, never fabricated dated events (D-018, D-019).
- Terminated employees are read-only for compensation but remain fully inspectable (D-014).
- The reporting date defaults to today and is user-selectable (D-013).

## How to handle new uncertainty
- If it changes domain meaning: add here and clarify before implementation when possible.
- If it is an engineering tradeoff: record in DECISIONS.md and proceed.
- If it is UI detail with no domain impact: choose the simplest consistent pattern from UI.md.
- Never ask the assessment owner to decide routine framework/library/architecture choices that should demonstrate engineering judgment.
