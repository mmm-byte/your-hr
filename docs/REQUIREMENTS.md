# Your HR — Product Requirements

## Product intent
Your HR replaces spreadsheet-driven employee compensation administration with a focused web application for an HR Manager responsible for a 10,000-person multinational workforce.

The product is **Core HR + Compensation**, not a full payroll/HCM suite. Its job is to make employee and salary data trustworthy, searchable, explainable, and safe to change.

## Primary persona
**HR Manager** — assumed authenticated for this assessment. Authentication/SSO is deliberately outside the MVP unless later requested.

### Access model (explicit)
There is **no login screen, session, or authentication layer**. The application opens directly to the
Overview page at `/`. Every visitor is treated as the HR Manager. Audit events attribute actions to a
fixed `hr-manager` surrogate, and a persistent notice on every page discloses that the environment is
an assessment with synthetic data and no authentication. See [SECURITY.md](SECURITY.md) for what a real
deployment would require before any real salary data is loaded.

## Problem
Spreadsheet workflows create fragmentation: current salary, history, organizational context, absences, reviews, and departures are difficult to inspect consistently. Multinational data adds country, branch, currency, and reporting concerns.

## Outcomes
The HR Manager must be able to:
1. Find an employee quickly among 10,000 records.
2. Understand an employee's employment context and current compensation.
3. Review salary history without overwriting historical truth.
4. Create a salary revision safely and explain why it changed.
5. Understand compensation across country, branch, department, job level, status, and currency.
6. Surface questionable or incomplete data before relying on it.
7. Export or communicate useful filtered information without exposing implementation details.

## MVP scope
### Workforce
- Employee directory with server-side search, filtering, sorting, and pagination.
- Employee profile with identity, employment, country/branch, job, status, work mode, and hire/termination context.

### Compensation
- Current base salary, bonus percentage, currency, effective date, and comparable USD-equivalent where the seeded model provides it.
- Effective-dated salary history.
- Salary revision workflow with validation, reason, and concurrency protection.
- Country/currency-aware formatting and analytics.

### Supporting context
- Absence summary/history.
- Latest performance context and historical reviews where useful.
- Attrition/termination context for departed employees.

### Insights
- Headcount and compensation summaries by useful organizational dimensions.
- Distribution/median/average views only when mathematically meaningful within the currency/reporting policy.
- Data-quality view for anomalies and incomplete/inconsistent records.

## Success criteria
- Reviewer can open a stable production URL and understand the product without setup.
- Exactly 10,000 seeded employees are represented.
- Employee directory remains usable without loading all records into the browser.
- Salary history is preserved across revisions.
- Currency is explicit everywhere money is shown.
- Core operations have deterministic tests and controlled error states.
- Architecture and AI use are explainable from repository artifacts and commit history.

## Deliberate exclusions
- Payroll execution, tax calculation, payslips, deductions, garnishments.
- Benefits, equity, retirement, insurance.
- Time-clock punch processing and shift scheduling.
- Recruiting/ATS and learning management.
- Real employee document storage.
- Live FX integration or claims of authoritative market compensation benchmarking.
- Enterprise SSO/RBAC beyond the assumed HR Manager persona.
- Employee self-service portal.
- Approval chains and compensation planning cycles.
- AI-generated SQL or unrestricted chat over sensitive salary data.
- Microservices, queues, caches, or additional datastores without demonstrated need.

These exclusions optimize for the assessment's salary-management problem and engineering quality rather than breadth.

## Product principles
- Historical truth over destructive edits.
- Explicit money/currency semantics over convenient totals.
- Server-side scalability over browser-heavy demos.
- Useful defaults, reversible actions, and clear errors.
- Synthetic data disclosed as synthetic.
- Simplicity is a feature.
