/**
 * Closed domain value sets (MON-001, QRY-003, QRY-005, D-024).
 *
 * Purpose: declare each closed vocabulary **once**, as a readonly tuple, so the
 * PostgreSQL enum types, the Zod request schemas, and the test factories cannot
 * drift apart. A filter allow-list that disagrees with the database column type
 * is a bug that only shows up at runtime; a single source makes it impossible.
 *
 * Called by: src/db/schema.ts (the pgEnum declarations), src/schemas/*.ts (the
 *           request allow-lists), and the test factories.
 * Reads: nothing — pure declarations, safe to import from any layer.
 * Rules: MON-001, QRY-003, QRY-005.
 * Tests: tests/unit/domain-values.test.ts
 *
 * Design notes
 * ------------
 * - These tuples are the *source*; `src/db/schema.ts` derives its `pgEnum`
 *   declarations from them. Drizzle copies the array it is given, so the
 *   migration's `CREATE TYPE` value order is preserved exactly.
 * - `src/lib` is the lowest layer of the application, so importing this file
 *   never drags in the database or a React Server Component boundary.
 * - The tuples are `as const`, which makes them readonly and gives each a
 *   literal union type. Zod's `z.enum` accepts them directly.
 */

/** Employment status. Mirrors the `employment_status` PostgreSQL enum. */
export const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'terminated'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

/** Work mode. Mirrors the `work_mode` PostgreSQL enum. */
export const WORK_MODES = ['remote', 'hybrid', 'office'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

/** Gender. Mirrors the `gender` PostgreSQL enum. */
export const GENDERS = ['Female', 'Male', 'Non-binary'] as const;
export type Gender = (typeof GENDERS)[number];

/** Local currency. Mirrors the `currency_code` PostgreSQL enum. */
export const CURRENCY_CODES = ['USD', 'INR', 'GBP', 'EUR', 'CAD', 'AUD'] as const;
export type CurrencyCodeValue = (typeof CURRENCY_CODES)[number];

/** Country. Mirrors the `country_code` PostgreSQL enum. */
export const COUNTRY_CODES = ['US', 'IN', 'GB', 'DE', 'CA', 'AU'] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

/** Localization method. Mirrors the `localization_method` PostgreSQL enum. */
export const LOCALIZATION_METHODS = ['synthetic_geo_factor_v1'] as const;
export type LocalizationMethod = (typeof LOCALIZATION_METHODS)[number];

/** Attrition reason. Mirrors the `attrition_reason` PostgreSQL enum. */
export const ATTRITION_REASONS = [
  'better_offer',
  'career_change',
  'relocation',
  'personal',
  'performance',
  'redundancy',
  'retirement',
] as const;
export type AttritionReason = (typeof ATTRITION_REASONS)[number];

/**
 * Job levels present in the approved cohort.
 *
 * `employees.job_level` is a plain `integer` column, not an enum, so this set
 * is a validation allow-list rather than a database type.
 */
export const JOB_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;
export type JobLevel = (typeof JOB_LEVELS)[number];

/**
 * Branch codes in the cohort.
 *
 * `branches.branch_code` is `text` with a unique index, not an enum, so this
 * is again a validation allow-list. The eight codes are the complete set in the
 * approved dataset.
 */
export const BRANCH_CODES = [
  'AU-SYD',
  'CA-TOR',
  'DE-BER',
  'GB-LON',
  'IN-BLR',
  'IN-HYD',
  'US-DAL',
  'US-NYC',
] as const;
export type BranchCode = (typeof BRANCH_CODES)[number];

/**
 * The 40 department names in the cohort.
 *
 * The source identifies a department by `department_id` and names it only
 * through the job titles that belong to it; the mapping is strictly 1:1 and is
 * verified at seed time (D-021). These names are therefore recovered, not
 * invented.
 */
export const DEPARTMENT_NAMES = [
  'Accounting',
  'Brand Marketing',
  'Compensation & Benefits',
  'Compliance',
  'Content',
  'Customer Success',
  'Customer Support',
  'Data Science',
  'Enterprise Sales',
  'Events',
  'Facilities',
  'Financial Planning',
  'Growth Marketing',
  'IT Support',
  'Infrastructure',
  'Internal Audit',
  'Learning & Development',
  'Legal',
  'Logistics',
  'Mid-Market Sales',
  'Mobile Engineering',
  'Partnerships',
  'Payroll',
  'People Operations',
  'Platform Engineering',
  'Procurement',
  'Product Design',
  'Product Management',
  'Product Marketing',
  'Professional Services',
  'Quality Assurance',
  'SMB Sales',
  'Sales Development',
  'Sales Operations',
  'Security Engineering',
  'Talent Acquisition',
  'Tax',
  'Technical Writing',
  'User Research',
  'Web Engineering',
] as const;
export type DepartmentName = (typeof DEPARTMENT_NAMES)[number];
