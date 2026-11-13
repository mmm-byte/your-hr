# Your HR — Database Design

## Goal
Use one PostgreSQL database as the application source of truth, normalized enough to preserve history and relationships without creating unnecessary infrastructure.

## Core tables
### `departments`
- `id` primary key
- `name` unique

### `branches`
- `id` primary key
- `branch_code` unique
- `name`
- `city`
- `country_code`
- `currency_code`

### `employees`
- `id` / stable employee ID primary key
- `first_name`, `last_name`, `email`
- `department_id` FK
- `job_title`, `job_level`
- `branch_id` FK
- `hire_date`, `termination_date`
- `employment_status`
- `gender`, `date_of_birth` (seeded context; not necessary for compensation decisions)
- `work_mode`
- `version` for optimistic concurrency where employee mutations need it
- timestamps

> **Concurrency (CON-001, CON-003).** `version` is incremented on every successful salary revision.
> A revision request carries the `expectedVersion` the user was shown; a mismatch is rejected as a
> conflict rather than overwriting newer data.

### `salary_records`
- `id` primary key
- `employee_id` FK
- `effective_from`
- exact-decimal local base salary
- `bonus_pct`
- `currency_code`
- optional seed provenance: source USD amount, USD-equivalent localized amount, geo factor, FX reference date, localization method
- application-created `change_reason`
- timestamps

Unique constraint: `(employee_id, effective_from)`.
Indexes: `(employee_id, effective_from DESC)` and fields justified by measured analytics/query plans.

> **Money precision (MON-002, verified against the seed).** `base_salary` and `usd_equivalent` are
> `numeric(12,2)`; `bonus_pct` is `numeric(5,2)`. The largest seeded localized salary is 9,647,953.00,
> so `numeric(12,2)` has sufficient headroom. Values are read back as strings and must never be parsed
> into a JavaScript `number`.
>
> **Date precision (RPT-004).** `effective_from`, `hire_date`, and `termination_date` are `date`, not
> `timestamptz`. A date-only value must not shift across time zones.

### `absence_records`
- `id`, `employee_id` FK
- `start_date`, `end_date`, `absence_type`, `days`
Index employee/date access.

> **Summary semantics (D-018, D-019, SEED-001).** The approved source contains only aggregate absence
> data — a record count and a total day count per employee — with no individual dated events. The table
> therefore stores one **summary row per employee** carrying the record count and total days. It does
> **not** fabricate dated absence events. A blank source summary means the employee has no absence
> records, which is distinct from zero days across N records, and the application preserves that
> distinction.

### `performance_reviews`
- `id`, `employee_id` FK
- `review_date`, `rating`, `goals_met_pct`, `promotion_recommended`
Index employee/review date.

> **Snapshot semantics (D-018, SEED-002).** The source provides only the **latest** review per employee,
> not a review history. The table stores that one row. Historical review records are not synthesized.

### `attrition_events`
- `id`, `employee_id` FK
- `left_on`, `reason`, `voluntary`, `exit_interview_score`

### `audit_events`
- UUID/ID primary key
- `actor_id` surrogate (assessment persona is HR Manager)
- `action`, `entity_type`, `entity_id`
- minimal before/after JSON where appropriate
- `correlation_id`
- `occurred_at`
Append-only through application behavior.

> **Actor surrogate (D-011, ACC-003).** With no authentication layer, `actor_id` is the fixed constant
> `hr-manager`. It is defined once in a shared module and referenced by the mutation path — never
> inlined per call site and never fabricated per session.

## Database constraints
Use database constraints for durable invariants:
- primary/foreign keys
- unique employee email if treated as corporate identity
- unique branch code
- unique employee/effective salary date
- positive salary
- valid bonus percentage
- valid review/goal ranges where practical
- termination date >= hire date

Complex cross-row or contextual rules live in domain/application services plus tests and transaction boundaries.

## Data-access policy
- Server-only Drizzle access.
- UI/client components never import the database driver/schema connection.
- Parameterized ORM/query-builder access only; no string-built SQL from user input.
- Queries return intentional projections, not `SELECT *` equivalents by habit.
- Large lists use limit/offset initially unless measured requirements justify cursor pagination.

## Migration policy
- Schema is changed only through committed Drizzle schema + migrations.
- Never rely on manual dashboard edits as undocumented schema state.
- Development migration first, verify, then production.
- Migration failure blocks seed/release.

## Seed policy
- Seed script loads the approved 10,000-person cohort and related records.
- Seed is deterministic and idempotent or safely refuses an already-seeded environment.
- Production seed is explicit, never invoked on every app startup/request.
- `db:verify` checks invariant counts and relationships after seed.

## Money
Prefer PostgreSQL exact numeric semantics for salary and bonus percentages. Convert to a safe application representation deliberately rather than trusting JavaScript floating-point arithmetic for authoritative calculations.

## Deletion policy
Hard deletion of historical employees/salaries is not an MVP user action. Employment termination is modeled by status/date. Historical salary/audit records remain.
