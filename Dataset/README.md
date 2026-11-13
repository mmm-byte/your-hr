# `Dataset` — Seed Inputs and Provenance

## Purpose
Approved synthetic seed files, small samples, validation reports, and provenance notes.

## Rules
- No real employee/candidate/customer data.
- Runtime reads PostgreSQL, not CSV.
- Do not edit generated final CSV manually; edit the deterministic transform and regenerate.
- Keep only files required for reproducibility/review; avoid unnecessary duplicate large files.
- Document source license/provenance and synthetic extensions.
- Validate CSV formula-injection risk before any exported file is opened/shared.

## Files
- `hr_employee_master_10000_multicountry_final.csv` — 10,000 employees with employment, organizational, location, and compensation-provenance attributes.
- `salaries_10000_multicountry_localized_final.csv` — 22,093 effective-dated salary records with localization provenance.
- `dataset_validation_report_final.csv` — deterministic invariant check results for the seed cohort.

## Relationships
All related records connect through `employee_id`. Country/branch/localized compensation are documented deterministic extensions. The meaning and acceptance rules for these files are defined in `docs/DATASET.md`.
