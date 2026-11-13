# Your HR — Requirement Traceability

This matrix prevents drift between product, UI, database, and tests. Update it as implementation paths become concrete.

| Capability | Domain rules | Data/database | UI surface | Test evidence |
|---|---|---|---|---|
| Find employees | EMP-*, QRY-001…007 | employees + branch/department indexes | `/employees` | `tests/unit/employment.test.ts` (employment state); `tests/unit/employee-directory-schema.test.ts`, `tests/unit/query-params.test.ts` (boundary); query + E2E search/filter in Phase 3 |
| View employee | EMP-*, MON-*, RPT-* | employees + current salary query | `/employees/[id]` | integration + not-found UI |
| View salary history | SAL-001,004,006,007,008 | salary_records | employee Compensation section | `tests/unit/current-salary.test.ts`, `tests/unit/salary-rules.test.ts` |
| Revise salary | SAL-002–012, AUD-*, ELG-*, CON-* | salary_records + audit_events transaction | `/employees/[id]/revise-salary` | domain + transaction + E2E |
| Multi-country compensation | MON-*, RPT-005/007 | branches/currency + localized seed provenance | profile/compensation/analytics | `tests/unit/money.test.ts` (exactness, formatting, single-currency total) |
| Compensation analytics | ANA-*, RPT-006/007 | aggregate queries/indexes | `/analytics`, `/compensation` | `tests/unit/analytics.test.ts` (median, empty≠zero, currency grouping); `tests/unit/compensation-analytics-schema.test.ts` (allow-listed metric/grouping) |
| Absence context | ABS-*, SEED-001/003 | absence_records (summary rows) | employee Absence section | summary-not-history tests |
| Performance context | PERF-*, SEED-002/003 | performance_reviews (latest only) | employee Performance section | snapshot-only tests |
| Attrition context | ATT-*, EMP-009 | attrition_events + employee termination | employee history | historical visibility tests |
| Data quality | dataset invariants | verification queries | `/data-quality` | deterministic issue classification |
| Access model | ACC-001…004 | — | global shell + assessment notice | `tests/unit/error-codes.test.ts`, `tests/unit/actor.test.ts` (ACC-003 surrogate) |
| Reporting date | RPT-001…004 | as-of queries | all money surfaces | `tests/unit/date-only.test.ts`, `tests/unit/current-salary.test.ts` |
| Date-only storage & decoding | RPT-004, D-021 | `date` columns via OID-1082 driver parser | every date surface | `tests/unit/date-parsers.test.ts`, `tests/integration/date-parsers.test.ts` (six timezones) |
| Seeded cohort | SEED-001…004, SAL-001/004/006, EMP-007, MON-002 | employees, salary_records, absence_records, performance_reviews, attrition_events | directory, profile, analytics | `tests/integration/seed.test.ts`, `tests/unit/seed-dataset.test.ts`, `pnpm db:verify` (29 checks) |
| Database invariants | SAL-002/003/006, EMP-002/004/005/006, MON-002, ABS-*, PERF-* | 8 tables, pgEnum types, CHECK/UNIQUE/index definitions | — (data layer) | `tests/integration/schema.test.ts` (20 constraint tests) |
| Closed value sets | MON-001, QRY-003, QRY-005, D-024 | `pgEnum` types derived from `src/lib/domain-values.ts` | filter options | `tests/unit/domain-values.test.ts`; byte-identical regenerated migration |
| Error handling | AUD-004, D-017 codes | — | error.tsx / not-found.tsx / inline errors | `tests/unit/error-codes.test.ts` |
| Navigation & routing | D-012 | — | all routes | deep-link + 404 + back/forward tests |
| Deployment readiness | ENVIRONMENT.md | health query | `/api/health` | build + smoke/health |

Do not treat this as bureaucracy. Its purpose is to answer: "If behavior changes here, what else must change?"
