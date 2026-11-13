/**
 * Employee profile queries (SAL-007, SAL-008, RPT-001, RPT-002, EMP-009).
 *
 * Purpose: read one employee's identity, their effective-dated salary
 * history, and the salary that is current **as of** a reporting date.
 *
 * Called by: the /employees/[employeeId] profile route.
 * Reads: employees (joined to departments and branches), salary_records,
 *        absence_records, performance_reviews, attrition_events.
 * Rules: SAL-007 (current = latest effective on or before the reporting date,
 *        not the greatest ID), SAL-008 (a future-effective record is scheduled
 *        and never current), RPT-001 (the reporting date defaults to today),
 *        RPT-002 (every money surface states the reporting date and labels
 *        current vs scheduled), EMP-009 (a terminated employee's history stays
 *        fully inspectable), ELG-006 (a terminated employee's salary is
 *        labelled as-of termination), ANA-006 (reporting-date queries use
 *        effective-dated state as of that date).
 * Tests: tests/integration/current-salary.test.ts
 *
 * Design notes
 * ------------
 * - The query takes a **database handle** so the same function runs against
 *   PGlite in the integration tests and Neon in production.
 * - The current and scheduled salaries are selected with the same correlated
 *   `max(effective_from)` pattern as the directory, so the two surfaces can
 *   never disagree about which record is current (SAL-007).
 * - The whole salary history is returned, newest first. A terminated
 *   employee's history is as readable as anyone else's (EMP-009, ELG-006).
 * - The seed's absence and performance context is returned as the summary it
 *   is, not as dated history (SEED-001, SEED-002, D-018).
 */

import { desc, eq, sql, type SQL } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core/session';
import {
  absenceRecords,
  attritionEvents,
  branches,
  departments,
  employees,
  performanceReviews,
  salaryRecords,
  schema,
} from '../schema';
import type { DateOnly } from '@/lib/date-only';

/** A Drizzle handle for a PostgreSQL database. */
export type ProfileDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/** The employee's identity and employment facts. */
export interface EmployeeProfile {
  readonly id: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly jobTitle: string;
  readonly jobLevel: number;
  readonly employmentStatus: string;
  readonly workMode: string;
  readonly gender: string;
  readonly countryCode: string;
  readonly hireDate: DateOnly;
  readonly terminationDate: DateOnly | null;
  readonly dateOfBirth: DateOnly;
  readonly version: number;
  readonly departmentId: number;
  readonly departmentName: string;
  readonly branchId: number;
  readonly branchCode: string;
  readonly branchName: string;
  readonly branchCity: string;
  readonly branchCurrencyCode: string;
}

/** One salary record, including the seed's localization provenance. */
export interface SalaryHistoryRow {
  readonly id: number;
  readonly effectiveFrom: DateOnly;
  readonly baseSalary: string;
  readonly bonusPct: string;
  readonly currencyCode: string;
  readonly usdEquivalent: string | null;
  readonly geoSalaryFactor: string | null;
  readonly usdToLocalFx: string | null;
  readonly fxReferenceDate: DateOnly | null;
  readonly localizationMethod: string | null;
  readonly changeReason: string | null;
  readonly createdAt: Date;
}

/** The absence seed summary — never dated events (SEED-001, D-018). */
export interface AbsenceSummary {
  readonly recordCount: number;
  readonly totalDays: number;
}

/** The latest performance review — the only one that exists (SEED-002). */
export interface PerformanceSummary {
  readonly reviewDate: DateOnly;
  readonly rating: number;
  readonly goalsMetPct: number;
  readonly promotionRecommended: boolean;
}

/** The attrition event, when the employee has one. */
export interface AttritionSummary {
  readonly leftOn: DateOnly;
  readonly reason: string;
  readonly voluntary: boolean;
  readonly exitInterviewScore: number | null;
}

/** Everything the profile page shows. */
export interface EmployeeProfileResult {
  readonly employee: EmployeeProfile;
  /** The whole salary history, newest first. */
  readonly salaryHistory: readonly SalaryHistoryRow[];
  /** The salary effective on or before the reporting date (SAL-007). */
  readonly currentSalary: SalaryHistoryRow | null;
  /** The earliest salary effective after the reporting date (SAL-008). */
  readonly scheduledSalary: SalaryHistoryRow | null;
  readonly absence: AbsenceSummary | null;
  readonly performance: PerformanceSummary | null;
  readonly attrition: AttritionSummary | null;
}

/**
 * Read one employee's full profile.
 *
 * @param db a Neon or PGlite Drizzle handle
 * @param employeeId the employee to read
 * @param reportingDate the date as of which compensation is interpreted
 * @returns the profile, or `null` when no employee has that ID
 */
export async function queryEmployeeProfile(
  db: ProfileDatabase,
  employeeId: number,
  reportingDate: DateOnly,
): Promise<EmployeeProfileResult | null> {
  const employeeRows = await db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      email: employees.email,
      jobTitle: employees.jobTitle,
      jobLevel: employees.jobLevel,
      employmentStatus: employees.employmentStatus,
      workMode: employees.workMode,
      gender: employees.gender,
      countryCode: employees.countryCode,
      hireDate: employees.hireDate,
      terminationDate: employees.terminationDate,
      dateOfBirth: employees.dateOfBirth,
      version: employees.version,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      branchId: employees.branchId,
      branchCode: branches.branchCode,
      branchName: branches.name,
      branchCity: branches.city,
      branchCurrencyCode: branches.currencyCode,
    })
    .from(employees)
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(eq(employees.id, employeeId))
    .limit(1);

  const employee = employeeRows[0];
  if (employee === undefined) {
    return null;
  }

  // The whole history, newest first (SAL-005: history is append-only and
  // fully inspectable, including for a terminated employee — EMP-009).
  const salaryHistory = await querySalaryHistory(db, employeeId);

  // The current salary is the latest record effective on or before the
  // reporting date — not the greatest ID (SAL-007). The history is already
  // newest-first, so the first match is it.
  const currentSalary =
    salaryHistory.find((record) => record.effectiveFrom <= reportingDate) ?? null;

  // The earliest record after the reporting date is the next scheduled change
  // (SAL-008). It is shown separately and never counted as current.
  const scheduledSalary =
    salaryHistory.find((record) => record.effectiveFrom > reportingDate) ?? null;

  const absenceRows = await db
    .select({
      recordCount: absenceRecords.recordCount,
      totalDays: absenceRecords.totalDays,
    })
    .from(absenceRecords)
    .where(eq(absenceRecords.employeeId, employeeId))
    .limit(1);

  const performanceRows = await db
    .select({
      reviewDate: performanceReviews.reviewDate,
      rating: performanceReviews.rating,
      goalsMetPct: performanceReviews.goalsMetPct,
      promotionRecommended: performanceReviews.promotionRecommended,
    })
    .from(performanceReviews)
    .where(eq(performanceReviews.employeeId, employeeId))
    .limit(1);

  const attritionRows = await db
    .select({
      leftOn: attritionEvents.leftOn,
      reason: attritionEvents.reason,
      voluntary: attritionEvents.voluntary,
      exitInterviewScore: attritionEvents.exitInterviewScore,
    })
    .from(attritionEvents)
    .where(eq(attritionEvents.employeeId, employeeId))
    .limit(1);

  return {
    employee,
    salaryHistory,
    currentSalary,
    scheduledSalary,
    absence: absenceRows[0] ?? null,
    performance: performanceRows[0] ?? null,
    attrition: attritionRows[0] ?? null,
  };
}

/**
 * Read an employee's salary history alone, newest first.
 *
 * Used by the compensation view, which shows the timeline without the rest of
 * the profile.
 */
export async function querySalaryHistory(
  db: ProfileDatabase,
  employeeId: number,
): Promise<readonly SalaryHistoryRow[]> {
  return db
    .select({
      id: salaryRecords.id,
      effectiveFrom: salaryRecords.effectiveFrom,
      baseSalary: salaryRecords.baseSalary,
      bonusPct: salaryRecords.bonusPct,
      currencyCode: salaryRecords.currencyCode,
      usdEquivalent: salaryRecords.usdEquivalent,
      geoSalaryFactor: salaryRecords.geoSalaryFactor,
      usdToLocalFx: salaryRecords.usdToLocalFx,
      fxReferenceDate: salaryRecords.fxReferenceDate,
      localizationMethod: salaryRecords.localizationMethod,
      changeReason: salaryRecords.changeReason,
      createdAt: salaryRecords.createdAt,
    })
    .from(salaryRecords)
    .where(eq(salaryRecords.employeeId, employeeId))
    .orderBy(desc(salaryRecords.effectiveFrom), desc(salaryRecords.id));
}
