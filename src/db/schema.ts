/**
 * Drizzle schema — the source of truth for the database shape (DATABASE.md).
 *
 * Purpose: define the eight core tables, their durable constraints, and the
 * indexes the directory and analytics queries rely on.
 * Called by: the database client (src/db/client.ts), query modules, and the
 *           migration generator (drizzle.config.ts).
 * Reads: nothing — this module only declares structure.
 * Rules: EMP-001…009, MON-001/002, SAL-001…007, ABS-001…004, PERF-001…003,
 *        ATT-001…003, AUD-001…004, CON-001/003, SEED-001…004.
 * Tests: tests/integration/schema.test.ts (constraints), migration SQL is
 *        applied verbatim to PGlite by tests/setup/integration.ts.
 *
 * Design notes
 * ------------
 * - Money is `numeric` in **string mode** so PostgreSQL's exact decimal
 *   semantics survive the round trip (MON-002). Values are never parsed into
 *   a JavaScript `number`.
 * - Dates that represent calendar days — hire, termination, effective-from,
 *   review, absence, attrition — are `date`, not `timestamptz`, so a value
 *   cannot shift across time zones (RPT-004).
 * - Check constraints carry the invariants that must hold no matter which
 *   code path writes a row. The seed, a migration, and a future import all
 *   get the same guarantees (DATABASE.md → Database constraints).
 * - The absence table stores one **summary row per employee**, never dated
 *   events (SEED-001, D-018). `total_days` may be 0 while records exist,
 *   which is why the constraint allows 0: "no rows" and "rows totalling zero
 *   days" are different states and must stay distinguishable (D-019).
 */
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  ATTRITION_REASONS,
  COUNTRY_CODES,
  CURRENCY_CODES,
  EMPLOYMENT_STATUSES,
  GENDERS,
  LOCALIZATION_METHODS,
  WORK_MODES,
} from '@/lib/domain-values';

/**
 * Closed value sets, declared once as PostgreSQL enums.
 *
 * A native enum is used rather than a `text` column plus a `CHECK`
 * constraint because the generated `CHECK ... in ($1, $2, ...)` form is not
 * valid SQL — drizzle-kit renders the list as bind parameters, which a
 * `CHECK` expression cannot contain. A `pgEnum` produces a real PostgreSQL
 * `CREATE TYPE ... AS ENUM`, so the database enforces the value set, the
 * migration is portable, and the TypeScript column type is narrowed to the
 * allowed values at the same time.
 *
 * The values come from `src/lib/domain-values.ts` so the database enums and
 * the Zod request allow-lists cannot drift apart (D-024). Drizzle copies the
 * array it is handed, so the tuple stays immutable and the generated
 * `CREATE TYPE` keeps the original value order.
 */
export const employmentStatusEnum = pgEnum('employment_status', EMPLOYMENT_STATUSES);
export const workModeEnum = pgEnum('work_mode', WORK_MODES);
export const genderEnum = pgEnum('gender', GENDERS);
export const currencyCodeEnum = pgEnum('currency_code', CURRENCY_CODES);
export const countryCodeEnum = pgEnum('country_code', COUNTRY_CODES);
export const localizationMethodEnum = pgEnum('localization_method', LOCALIZATION_METHODS);
export const attritionReasonEnum = pgEnum('attrition_reason', ATTRITION_REASONS);

/**
 * The closed value sets live in `src/lib/domain-values.ts` so the database
 * enums and the Zod request allow-lists cannot drift (D-024). They are
 * re-exported here because `src/db/schema.ts` is the public face of the
 * database shape.
 */
export {
  ATTRITION_REASONS,
  BRANCH_CODES,
  COUNTRY_CODES,
  CURRENCY_CODES,
  DEPARTMENT_NAMES,
  EMPLOYMENT_STATUSES,
  GENDERS,
  JOB_LEVELS,
  LOCALIZATION_METHODS,
  WORK_MODES,
} from '@/lib/domain-values';

/**
 * Departments — the 40 functional groupings in the cohort.
 *
 * The source identifies a department by `department_id` and names it only
 * through the job titles that belong to it. The mapping is strictly 1:1 and
 * is verified at seed time (D-021), so `name` is recoverable rather than
 * invented.
 */
export const departments = pgTable(
  'departments',
  {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
  },
  (table) => [uniqueIndex('departments_name_unique').on(table.name)],
);

/**
 * Branches — the eight modelled offices. A branch belongs to exactly one
 * country and carries that country's currency, which is what makes
 * EMP-007 (branch belongs to the employee's country) checkable.
 */
export const branches = pgTable(
  'branches',
  {
    id: integer('id').primaryKey(),
    branchCode: text('branch_code').notNull(),
    name: text('name').notNull(),
    city: text('city').notNull(),
    countryCode: countryCodeEnum('country_code').notNull(),
    currencyCode: currencyCodeEnum('currency_code').notNull(),
  },
  (table) => [uniqueIndex('branches_branch_code_unique').on(table.branchCode)],
);

/**
 * Employees — the stable workforce identity.
 *
 * `id` is the source employee ID and is never reused or rewritten
 * (EMP-001). `email` is the corporate identifier and is unique (EMP-002).
 * `version` is the optimistic-concurrency token for compensation writes
 * (CON-001, CON-003).
 */
export const employees = pgTable(
  'employees',
  {
    id: integer('id').primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    departmentId: integer('department_id')
      .notNull()
      .references(() => departments.id),
    jobTitle: text('job_title').notNull(),
    jobLevel: integer('job_level').notNull(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id),
    countryCode: countryCodeEnum('country_code').notNull(),
    hireDate: date('hire_date', { mode: 'string' }).notNull(),
    terminationDate: date('termination_date', { mode: 'string' }),
    employmentStatus: employmentStatusEnum('employment_status').notNull(),
    gender: genderEnum('gender').notNull(),
    dateOfBirth: date('date_of_birth', { mode: 'string' }).notNull(),
    workMode: workModeEnum('work_mode').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('employees_email_unique').on(table.email),
    index('employees_branch_id_idx').on(table.branchId),
    index('employees_department_id_idx').on(table.departmentId),
    index('employees_employment_status_idx').on(table.employmentStatus),
    index('employees_work_mode_idx').on(table.workMode),
    index('employees_job_level_idx').on(table.jobLevel),
    index('employees_country_code_idx').on(table.countryCode),
    // EMP-004: a termination date may never precede the hire date.
    check(
      'employees_termination_after_hire_check',
      sql`${table.terminationDate} is null or ${table.terminationDate} >= ${table.hireDate}`,
    ),
    // EMP-005: an employee who is still with the company has no termination
    // date. A non-terminated status therefore requires a NULL termination
    // date.
    check(
      'employees_active_has_no_termination_check',
      sql`${table.employmentStatus} = 'terminated' or ${table.terminationDate} is null`,
    ),
    // EMP-006: a terminated employee must record when they left.
    check(
      'employees_terminated_requires_termination_check',
      sql`${table.employmentStatus} <> 'terminated' or ${table.terminationDate} is not null`,
    ),
  ],
);

/**
 * Salary records — the effective-dated history of base salary and bonus.
 *
 * A revision appends a new row; it never rewrites an existing one
 * (SAL-005). One effective date per employee is enforced by a unique
 * constraint (SAL-006), and the `(employee_id, effective_from DESC)` index
 * serves the "salary effective on date X" lookup (SAL-007).
 *
 * The seed's localization provenance is kept alongside the amount so the
 * currency story stays auditable: the local amount, its synthetic USD
 * equivalent, the factors used, and the fixed FX reference date (MON-005,
 * MON-006, SEED-004).
 */
export const salaryRecords = pgTable(
  'salary_records',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    baseSalary: numeric('base_salary', { precision: 12, scale: 2, mode: 'string' }).notNull(),
    bonusPct: numeric('bonus_pct', { precision: 5, scale: 2, mode: 'string' }).notNull().default('0'),
    currencyCode: currencyCodeEnum('currency_code').notNull(),
    sourceBaseSalaryUsd: numeric('source_base_salary_usd', {
      precision: 12,
      scale: 2,
      mode: 'string',
    }),
    usdEquivalent: numeric('usd_equivalent', { precision: 12, scale: 2, mode: 'string' }),
    geoSalaryFactor: numeric('geo_salary_factor', { precision: 8, scale: 4, mode: 'string' }),
    usdToLocalFx: numeric('usd_to_local_fx', { precision: 12, scale: 5, mode: 'string' }),
    fxReferenceDate: date('fx_reference_date', { mode: 'string' }),
    localizationMethod: localizationMethodEnum('localization_method'),
    /** Set only on records the application creates (SAL-009). */
    changeReason: text('change_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('salary_records_employee_effective_unique').on(
      table.employeeId,
      table.effectiveFrom,
    ),
    index('salary_records_employee_effective_desc_idx').on(
      table.employeeId,
      table.effectiveFrom.desc(),
    ),
    index('salary_records_currency_code_idx').on(table.currencyCode),
    check('salary_records_base_salary_positive_check', sql`${table.baseSalary} > 0`),
    check(
      'salary_records_bonus_pct_range_check',
      sql`${table.bonusPct} >= 0 and ${table.bonusPct} <= 100`,
    ),
  ],
);

/**
 * Absence summary — one row per employee, never dated events (SEED-001).
 *
 * `recordCount` and `totalDays` are the aggregate the approved source
 * provides. An employee with no absences has **no row** (D-019), which is
 * what lets the UI distinguish "no absence records" from "0 absence days".
 */
export const absenceRecords = pgTable(
  'absence_records',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id),
    recordCount: integer('record_count').notNull(),
    totalDays: integer('total_days').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('absence_records_employee_unique').on(table.employeeId),
    check('absence_records_record_count_positive_check', sql`${table.recordCount} > 0`),
    check('absence_records_total_days_non_negative_check', sql`${table.totalDays} >= 0`),
  ],
);

/**
 * Performance review — the employee's latest review only (SEED-002).
 *
 * The source has no review history, so exactly one row per employee is
 * stored and no historical reviews are synthesized.
 */
export const performanceReviews = pgTable(
  'performance_reviews',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id),
    reviewDate: date('review_date', { mode: 'string' }).notNull(),
    rating: integer('rating').notNull(),
    goalsMetPct: integer('goals_met_pct').notNull(),
    promotionRecommended: boolean('promotion_recommended').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('performance_reviews_employee_unique').on(table.employeeId),
    index('performance_reviews_review_date_idx').on(table.reviewDate),
    check('performance_reviews_rating_range_check', sql`${table.rating} between 1 and 5`),
    check(
      'performance_reviews_goals_met_range_check',
      sql`${table.goalsMetPct} between 0 and 100`,
    ),
  ],
);

/**
 * Attrition event — the record of how an employee left (ATT-001).
 *
 * Only terminated employees have one. Departed employees stay searchable
 * (ATT-002) and exit-interview data never changes compensation (ATT-003).
 */
export const attritionEvents = pgTable(
  'attrition_events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id),
    leftOn: date('left_on', { mode: 'string' }).notNull(),
    reason: attritionReasonEnum('reason').notNull(),
    voluntary: boolean('voluntary').notNull(),
    exitInterviewScore: integer('exit_interview_score'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('attrition_events_employee_unique').on(table.employeeId),
    index('attrition_events_left_on_idx').on(table.leftOn),
    check(
      'attrition_events_exit_score_range_check',
      sql`${table.exitInterviewScore} is null or ${table.exitInterviewScore} between 1 and 10`,
    ),
  ],
);

/**
 * Audit events — append-only evidence of every application mutation
 * (AUD-001, AUD-002).
 *
 * The actor is the fixed surrogate `hr-manager` because the application has
 * no authentication layer (ACC-003, D-011). Before/after payloads hold only
 * what is needed to explain a change, never whole salary histories
 * (AUD-003). The correlation ID is the only diagnostic handle shown to a
 * user (AUD-004).
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: text('actor_id').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    correlationId: text('correlation_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_events_entity_idx').on(table.entityType, table.entityId),
    index('audit_events_occurred_at_idx').on(table.occurredAt.desc()),
    index('audit_events_correlation_id_idx').on(table.correlationId),
  ],
);

/**
 * The whole schema, for the Drizzle client and the migration generator.
 */
export const schema = {
  departments,
  branches,
  employees,
  salaryRecords,
  absenceRecords,
  performanceReviews,
  attritionEvents,
  auditEvents,
};

export type Department = typeof departments.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type SalaryRecord = typeof salaryRecords.$inferSelect;
export type NewSalaryRecord = typeof salaryRecords.$inferInsert;
export type AbsenceSummary = typeof absenceRecords.$inferSelect;
export type PerformanceReview = typeof performanceReviews.$inferSelect;
export type AttritionEvent = typeof attritionEvents.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
