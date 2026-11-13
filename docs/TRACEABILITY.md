# Your HR — Requirement Traceability

This matrix prevents drift between product, UI, database, and tests. Update it as implementation paths become concrete.

| Capability | Domain rules | Data/database | UI surface | Test evidence |
|---|---|---|---|---|
| Find employees | EMP-*, QRY-001…007 | employees + branch/department indexes | `/employees` | `tests/unit/employment.test.ts` (employment state); query + E2E search/filter in Phase 3 |
| View employee | EMP-*, MON-*, RPT-* | employees + current salary query | `/employees/[id]` | integration + not-found UI |
| View salary history | SAL-001,004,006,007,008 | salary_records | employee Compensation section | `tests/unit/current-salary.test.ts`, `tests/unit/salary-rules.test.ts` |
| Revise salary | SAL-002–012, AUD-*, ELG-*, CON-* | salary_records + audit_events transaction | `/employees/[id]/revise-salary` | domain + transaction + E2E |
| Multi-country compensation | MON-*, RPT-005/007 | branches/currency + localized seed provenance | profile/compensation/analytics | currency semantics tests |
| Compensation analytics | ANA-*, RPT-006/007 | aggregate queries/indexes | `/analytics`, `/compensation` | `tests/unit/money.test.ts` (median/empty/currency) |
| Absence context | ABS-*, SEED-001/003 | absence_records (summary rows) | employee Absence section | summary-not-history tests |
| Performance context | PERF-*, SEED-002/003 | performance_reviews (latest only) | employee Performance section | snapshot-only tests |
| Attrition context | ATT-*, EMP-009 | attrition_events + employee termination | employee history | historical visibility tests |
| Data quality | dataset invariants | verification queries | `/data-quality` | deterministic issue classification |
| Access model | ACC-001…004 | — | global shell + assessment notice | `tests/unit/error-codes.test.ts`; actor surrogate is `src/lib/actor.ts` (Phase 2 test) |
| Reporting date | RPT-001…004 | as-of queries | all money surfaces | `tests/unit/date-only.test.ts`, `tests/unit/current-salary.test.ts` |
| Error handling | AUD-004, D-017 codes | — | error.tsx / not-found.tsx / inline errors | `tests/unit/error-codes.test.ts` |
| Navigation & routing | D-012 | — | all routes | deep-link + 404 + back/forward tests |
| Deployment readiness | ENVIRONMENT.md | health query | `/api/health` | build + smoke/health |

Do not treat this as bureaucracy. Its purpose is to answer: "If behavior changes here, what else must change?"
