# Your HR — Requirement Traceability

This matrix prevents drift between product, UI, database, and tests. Update it as implementation paths become concrete.

| Capability | Domain rules | Data/database | UI surface | Test evidence |
|---|---|---|---|---|
| Find employees | EMP-*, QRY-001…007 | employees + branch/department indexes | `/employees` | query integration + E2E search/filter |
| View employee | EMP-*, MON-*, RPT-* | employees + current salary query | `/employees/[id]` | integration + not-found UI |
| View salary history | SAL-001,004,006,007,008 | salary_records | employee Compensation section | current-as-of-date + ordering tests |
| Revise salary | SAL-002–012, AUD-*, ELG-*, CON-* | salary_records + audit_events transaction | `/employees/[id]/revise-salary` | domain + transaction + E2E |
| Multi-country compensation | MON-*, RPT-005/007 | branches/currency + localized seed provenance | profile/compensation/analytics | currency semantics tests |
| Compensation analytics | ANA-*, RPT-006/007 | aggregate queries/indexes | `/analytics`, `/compensation` | aggregate/median/empty tests |
| Absence context | ABS-*, SEED-001/003 | absence_records (summary rows) | employee Absence section | summary-not-history tests |
| Performance context | PERF-*, SEED-002/003 | performance_reviews (latest only) | employee Performance section | snapshot-only tests |
| Attrition context | ATT-*, EMP-009 | attrition_events + employee termination | employee history | historical visibility tests |
| Data quality | dataset invariants | verification queries | `/data-quality` | deterministic issue classification |
| Access model | ACC-001…004 | — | global shell + assessment notice | no-auth + actor-surrogate tests |
| Reporting date | RPT-001…004 | as-of queries | all money surfaces | default/URL/no-TZ-shift tests |
| Error handling | AUD-004, D-017 codes | — | error.tsx / not-found.tsx / inline errors | catalogue → recovery mapping tests |
| Navigation & routing | D-012 | — | all routes | deep-link + 404 + back/forward tests |
| Deployment readiness | ENVIRONMENT.md | health query | `/api/health` | build + smoke/health |

Do not treat this as bureaucracy. Its purpose is to answer: "If behavior changes here, what else must change?"
