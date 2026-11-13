# Your HR — Server Contract

## Philosophy
Next.js is one full-stack application. Internal server components may call server-side data functions directly; do not create REST endpoints just to imitate a separate backend. Expose route handlers only where an HTTP contract is useful (health/export/integration) and use server actions or server-side application functions for internal mutations as appropriate.

## Shared contract rules
- Validate untrusted input with Zod on server boundaries.
- Use canonical glossary names.
- Never return database credentials, raw errors, or stack traces.
- Pagination/filter/sort inputs are bounded/allow-listed.
- Mutation errors use stable machine-readable codes plus safe human messages.
- All currency-bearing responses include explicit currency.

## Query contracts
### Employee directory
Inputs: page, pageSize bounded to a reasonable limit, search, country, branch, department, level, status, workMode, allow-listed sort.
Output: rows + total count + page metadata.

**Directory query semantics (binding — QRY-001…QRY-007):**

| Concern | Contract |
|---|---|
| Search fields | Employee ID (exact or prefix), full name (contains), email (contains) |
| Search normalization | Trimmed, case-insensitive |
| Literal characters | `%`, `_`, `'`, `\` are literal text — never SQL wildcards or escape sequences |
| Page size | Default and maximum are fixed constants; a larger request is clamped, not rejected |
| Page out of range | Empty rows with the real total count — not an error |
| Sort | Explicit allow-list. An unrecognised value falls back to the default sort (stable, deterministic) |
| Unknown filter value | Ignored in favour of the documented default; never an error |
| Filter change | Resets to page 1 |
| Empty result | Response distinguishes "no data" from "no rows match these filters" |
| Currency | Every money value carries its ISO currency code |

### Employee profile
Input: employeeId.
Output: employee employment projection + current salary as-of reporting date + available supporting summaries.
Not found: controlled not-found behavior.

### Salary history
Input: employeeId; optional reporting scope.
Output: ordered effective-dated salary records.

### Compensation analytics
Inputs: allow-listed metric/groupBy/filters/reportingDate.
Output: labeled groups and currency/reporting semantics.
No arbitrary column names or generated SQL accepted from clients.

**Reporting date (RPT-001, RPT-003):** every money-bearing query accepts an optional `asOf` date.
Default is the current calendar date. It is date-only and is never timezone-converted.
Results distinguish a current record from a scheduled (future-effective) one.

## Mutation contract — salary revision
Input:
- employeeId
- expectedVersion/current-state token if implemented at employee/aggregrate level
- baseSalary
- currency (normally fixed from modeled policy unless an allowed migration is documented)
- bonusPct
- effectiveFrom
- reason

Server checks domain rules, concurrency, and transaction boundary.
Success returns new salary state / revision ID and enough data to refresh UI.
Failure codes should distinguish validation, not-found, conflict, and unexpected failure without leaking internals.

**Revision contract (binding — ELG-001…ELG-006, CON-001…CON-003, D-014, D-017):**

| Concern | Contract |
|---|---|
| Eligibility | `active` or `on_leave` only. A terminated employee is rejected with `SALARY_NOT_ELIGIBLE`. |
| Effective-date window | `hireDate ≤ effectiveFrom ≤ terminationDate` (or ≤ today when not terminated) |
| Currency | Fixed by the employee's modelled country/branch policy. A submitted currency that differs is rejected, never silently overridden. |
| Reason | Required for application-created records, non-blank after trimming (SAL-009) |
| Bonus | 0–100 inclusive; positive base salary (SAL-002, SAL-003) |
| Concurrency | The client sends the `expectedVersion` it was shown. A mismatch returns `SALARY_VERSION_CONFLICT` and writes nothing (SAL-011, CON-001) |
| Idempotency | A duplicate effective date returns `SALARY_EFFECTIVE_DATE_CONFLICT` and writes nothing (SAL-006) |
| Atomicity | The salary record and its audit event are written in **one transaction**. A failure in either rolls back both (SAL-010, AUD-001) |
| Version increment | On success, the employee compensation version increments (CON-003) |
| Money | Base salary is accepted and stored as an exact decimal string. It is never parsed into a JS float. |

**Stable error codes** — see D-017 for the full catalogue. The API returns them in the `error.code`
field; the UI maps the same codes to specific recovery actions.

## HTTP route handlers reserved for clear use cases
### `GET /api/health`
Safe application/database readiness response only; no database host/version/secrets.

### Export route, only if P1 export is built
Uses current validated filter contract; escapes spreadsheet-formula prefixes; appropriate content type/filename.

## Error shape guideline
```json
{
  "error": {
    "code": "SALARY_EFFECTIVE_DATE_CONFLICT",
    "message": "A salary revision already exists for that effective date.",
    "fieldErrors": {},
    "correlationId": "..."
  }
}
```
Exact framework representation may differ, but stable semantics must remain.

**The `code` value MUST come from the stable catalogue in D-017** — it is never free text.
`fieldErrors` maps a form field name to a message for validation failures only.
`correlationId` is present on every error and is the only diagnostic handle exposed to the user (AUD-004).
