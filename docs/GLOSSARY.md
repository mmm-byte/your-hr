# Your HR — Canonical Glossary

Use these names across database, server, UI, docs, and tests. Avoid synonyms that create drift.

- **Employee** — person represented in the HR dataset.
- **Employee ID** — immutable cross-dataset identifier.
- **Department** — organizational functional grouping.
- **Branch** — modeled office/location entity within one country.
- **Country** — employee's modeled work country in the synthetic multinational extension.
- **Job Title** — named role.
- **Job Level** — seeded numeric seniority level.
- **Employment Status** — seeded state such as active, on leave, or terminated.
- **Work Mode** — office, hybrid, or remote.
- **Base Salary** — annual base salary amount in the record's explicit currency.
- **Bonus Percentage** — seeded percentage associated with a salary record; not a paid bonus transaction.
- **Salary Record** — an effective-dated compensation state for one employee.
- **Current Salary** — the salary record effective on or before the reporting date, with the greatest effective date. A record effective after the reporting date is **Scheduled**, not current.
- **Salary Revision** — application workflow adding a new effective-dated salary record.
- **Local Currency** — modeled currency for the employee's country/branch.
- **USD Equivalent** — synthetic reporting/comparison value derived through the documented seed localization model; not a live conversion.
- **Reporting Date** — the calendar date as of which effective-dated records are interpreted. Defaults to today, is user-selectable, and appears in the URL so a shared link reproduces the same view.
- **Absence** — seeded absence context. The source provides a record count and total days per employee, so it is represented as a **Seed Summary**, not as dated leave events. It does not imply remaining PTO balance.
- **Performance Review** — seeded performance context, represented as the **latest** review only; there is no seeded review history. It is not an automatic salary decision input.
- **Attrition Event** — seeded departure event for an employee.
- **Audit Event** — application-generated append-only evidence of a sensitive mutation.
- **Data Quality Issue** — deterministic rule finding requiring attention; not necessarily corrupt data.
- **HR Manager** — sole assumed authenticated persona for the assessment MVP. The MVP has no authentication layer; this persona is assumed, not verified.
- **Scheduled Salary** — a salary record whose effective date is after the reporting date. It is displayed as scheduled and is never counted as current compensation.
- **Seed Summary** — an aggregate figure derived from the seed data (for example total absence days across N records) rather than a dated event. Always labelled as a summary so it is not mistaken for event history.
- **Stable Error Code** — a fixed identifier from the catalogue in `DECISIONS.md` (D-017) that names a failure mode without exposing internals.
