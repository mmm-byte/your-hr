# Your HR — Dataset Contract

## Purpose
This file defines what the application seed data means. The application must not silently reinterpret these fields.

## Seed cohort
The assessment seed uses a deterministic cohort of **10,000 employees** derived from the supplied synthetic HR dataset. Related salary, absence, performance, and attrition records are restricted to those employee IDs.

## Source entities
- Employees: identity/employment attributes including job, level, dates, status, work mode.
- Salaries: effective-dated base salary, bonus percentage, currency.
- Absences: dated absence records and type/duration.
- Performance reviews: review date, rating, goals met, promotion recommendation.
- Attrition events: departure date/reason, voluntary flag, exit interview score.

## Synthetic multinational extension
The original salary data was USD-only and did not model countries. A deterministic synthetic extension assigns the 10,000-person cohort to:
- United States — Dallas, New York — USD
- India — Bengaluru, Hyderabad — INR
- United Kingdom — London — GBP
- Germany — Berlin — EUR
- Canada — Toronto — CAD
- Australia — Sydney — AUD

The country/branch assignment and salary localization are **assessment modeling assumptions**, not original-source facts and not market compensation benchmarks.

## Salary localization model
The final seed preserves original salary provenance and derives localized values using documented deterministic geographic factors plus a fixed FX reference date. The purpose is to produce internally coherent multinational demonstration data, not to assert real-world pay competitiveness.

Required provenance fields include, where applicable:
- source base salary in USD
- localization factor/method
- local currency
- localized salary
- USD-equivalent localized salary
- FX reference date

No runtime code may fabricate a different country, currency, or salary localization policy.

## Identity and relationships
`employee_id` is the stable cross-file identity. Related entities reference it. The import/seed process must reject or report orphan records rather than invent employees.

## Data invariants before seed is accepted
- Exactly 10,000 unique employees.
- No duplicate employee IDs.
- Every employee has country and branch.
- Every employee has a current salary.
- Salary is positive; bonus percentage is within supported bounds.
- Currency aligns with the employee's modeled country policy.
- Salary effective date does not precede hire date.
- Duplicate salary records for the same employee/effective date are resolved deterministically before import.
- Termination date never precedes hire date.
- Active employees do not carry termination dates; terminated employees have them.
- Absence end date is not before start date and duration is positive.
- Performance ratings and goal percentages are inside documented ranges.
- No orphan salary, absence, review, or attrition records.

## Privacy
All records are synthetic. Do not replace them with real employee or candidate data. Do not use real emergency contacts, bank information, government IDs, or tax records.

## Runtime policy
- Database is the runtime source of truth after seed.
- CSV files are seed inputs/provenance, not a runtime datastore.
- Production changes happen through application/domain workflows and migrations, not by editing CSVs.
- Reseeding production must be explicit and safe.

## Known limitations
- Location and localization are synthetic extensions.
- Fixed FX values are a reproducibility device, not live FX.
- Dataset does not model payroll taxes/deductions/benefits.
- Performance and absence information is context, not a permitted automatic justification for compensation decisions.
