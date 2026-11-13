# `src/lib` — Small Shared Utilities

## Purpose
Only stable, cross-cutting helpers with clear ownership.

## Allowed examples
- currency/date formatting
- safe error/correlation utility
- small pure helpers used in multiple features

## Forbidden
- dumping-ground business logic
- ambiguous `helpers.ts`
- database access mixed with browser utilities
- speculative generic frameworks

Before adding a utility, search for an existing one and confirm at least two genuine consumers or one clearly stable cross-cutting concern.

## Modules
| Module | Owns | Rules |
|---|---|---|
| `domain-values.ts` | Every closed value set, declared once as a readonly tuple | MON-001, QRY-003, QRY-005, D-024 |
| `money.ts` | Exact decimal money, currency metadata, the central formatter | MON-001…006, RPT-005…007 |
| `date-only.ts` | `YYYY-MM-DD` calendar days with no timezone shift | RPT-004, RPT-001 |
| `salary-rules.ts` | Salary revision validation and eligibility | SAL-002…009, SAL-012, ELG-001…004, CON-001 |
| `current-salary.ts` | As-of-date salary selection and future-effective labelling | SAL-007, SAL-008, RPT-001, RPT-002 |
| `analytics.ts` | Median, average, and grouped counts over exact money | ANA-001…005, RPT-006, RPT-007 |
| `employment.ts` | Hire/termination/status invariants | EMP-003…006, EMP-009, ELG-006 |
| `actor.ts` | The fixed actor surrogate every mutation is attributed to | ACC-003 |
| `error-codes.ts` | The stable error-code catalogue and its user-facing recoveries | D-017, AUD-004 |

Every module here is **pure** — no database access, no network, no clock read at import
time. `domain-values.ts` is the lowest layer of the application, so it can be imported
from anywhere without pulling in the database or a server-only boundary.
