/**
 * Seed dataset mapping — the pure transformation from the approved CSVs to
 * rows ready for insertion.
 *
 * Purpose: turn the two source files into the exact row shapes the schema
 * expects, with every validation the dataset contract requires performed
 * before anything is written to the database.
 * Called by: scripts/seed.ts.
 * Reads: Dataset/hr_employee_master_10000_multicountry_final.csv and
 *        Dataset/salaries_10000_multicountry_localized_final.csv.
 * Rules: DATASET.md, EMP-001…009, MON-001/002/005, SAL-001…007,
 *        ABS-001/002, PERF-001/002, ATT-001, SEED-001…004.
 * Tests: tests/unit/seed-dataset.test.ts.
 *
 * This module is deliberately free of database access so it can be tested
 * without a database and reused by the verification script.
 *
 * Two mappings deserve explanation:
 *
 * **Department names.** The source names a department only through the job
 * titles that belong to it. Every title carries the department name after
 * its first comma (`"Lead, Platform Engineering"` → `Platform Engineering`),
 * and the mapping is strictly 1:1 across all 40 departments. The name is
 * therefore recovered from the source rather than invented, and
 * `assertDepartmentMapping` fails the seed if that ever stops holding.
 *
 * **Absence summaries.** The source provides aggregate counts, not events.
 * An employee with a blank summary has no absence records and gets **no
 * row**; that is what keeps "no absences" distinct from "zero absence
 * days" (D-019, SEED-001).
 */
import {
  booleanValue,
  cell,
  decimalValue,
  indexColumns,
  integerValue,
  nullableDecimalValue,
  nullableIntegerValue,
  nullableValue,
  optionalCell,
  requiredValue,
  type CsvTable,
} from './csv';

/** A department ready for insertion. */
export interface DepartmentRow {
  id: number;
  name: string;
}

/** A branch ready for insertion. */
export interface BranchRow {
  id: number;
  branchCode: string;
  name: string;
  city: string;
  countryCode: string;
  currencyCode: string;
}

/** An employee ready for insertion. */
export interface EmployeeRow {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: number;
  jobTitle: string;
  jobLevel: number;
  branchId: number;
  countryCode: string;
  hireDate: string;
  terminationDate: string | null;
  employmentStatus: string;
  gender: string;
  dateOfBirth: string;
  workMode: string;
}

/** A salary record ready for insertion. */
export interface SalaryRow {
  employeeId: number;
  effectiveFrom: string;
  baseSalary: string;
  bonusPct: string;
  currencyCode: string;
  sourceBaseSalaryUsd: string | null;
  usdEquivalent: string | null;
  geoSalaryFactor: string | null;
  usdToLocalFx: string | null;
  fxReferenceDate: string | null;
  localizationMethod: string | null;
}

/** An absence summary ready for insertion. */
export interface AbsenceRow {
  employeeId: number;
  recordCount: number;
  totalDays: number;
}

/** A performance review ready for insertion. */
export interface ReviewRow {
  employeeId: number;
  reviewDate: string;
  rating: number;
  goalsMetPct: number;
  promotionRecommended: boolean;
}

/** An attrition event ready for insertion. */
export interface AttritionRow {
  employeeId: number;
  leftOn: string;
  reason: string;
  voluntary: boolean;
  exitInterviewScore: number | null;
}

/** Every row the seed writes, grouped by table. */
export interface SeedDataset {
  departments: DepartmentRow[];
  branches: BranchRow[];
  employees: EmployeeRow[];
  salaries: SalaryRow[];
  absences: AbsenceRow[];
  reviews: ReviewRow[];
  attritions: AttritionRow[];
}

/**
 * Recover a department name from a job title.
 *
 * The title's first comma separates the seniority from the department, so
 * `"Senior Specialist, Accounting"` yields `Accounting`.
 */
export function departmentNameFromJobTitle(jobTitle: string): string {
  const separator = jobTitle.indexOf(',');
  if (separator === -1) {
    throw new Error(`Job title "${jobTitle}" has no department suffix.`);
  }
  const name = jobTitle.slice(separator + 1).trim();
  if (name === '') {
    throw new Error(`Job title "${jobTitle}" has an empty department suffix.`);
  }
  return name;
}

/**
 * Assert that the job-title suffix maps 1:1 onto departments.
 *
 * Guards the department-name recovery: if one department owned two different
 * suffixes, or two departments shared a suffix, the derived names would be
 * ambiguous and the seed must stop rather than guess.
 *
 * @throws when the mapping is not strictly 1:1.
 */
export function assertDepartmentMapping(
  pairs: ReadonlyArray<{ departmentId: number; jobTitle: string }>,
): void {
  const departmentToName = new Map<number, string>();
  const nameToDepartment = new Map<string, number>();

  for (const { departmentId, jobTitle } of pairs) {
    const name = departmentNameFromJobTitle(jobTitle);
    const existingName = departmentToName.get(departmentId);
    if (existingName !== undefined && existingName !== name) {
      throw new Error(
        `Department ${departmentId} maps to both "${existingName}" and "${name}".`,
      );
    }
    const existingDepartment = nameToDepartment.get(name);
    if (existingDepartment !== undefined && existingDepartment !== departmentId) {
      throw new Error(
        `Department name "${name}" maps to both department ${existingDepartment} and ${departmentId}.`,
      );
    }
    departmentToName.set(departmentId, name);
    nameToDepartment.set(name, departmentId);
  }
}

/**
 * Build every seed row from the two parsed CSV tables.
 *
 * @throws when any dataset invariant is violated — a missing value, an
 * orphaned salary row, a salary effective before the hire date, a currency
 * that changes across an employee's history, or a duplicate effective date.
 */
export function buildSeedDataset(master: CsvTable, salaries: CsvTable): SeedDataset {
  const masterColumns = indexColumns(master.header);
  const salaryColumns = indexColumns(salaries.header);

  const departments = new Map<number, string>();
  const branches = new Map<string, BranchRow>();
  const branchIds = new Map<string, number>();
  const employees: EmployeeRow[] = [];
  const absences: AbsenceRow[] = [];
  const reviews: ReviewRow[] = [];
  const attritions: AttritionRow[] = [];
  const employeeById = new Map<number, EmployeeRow>();
  const employeePairs: Array<{ departmentId: number; jobTitle: string }> = [];

  for (const row of master.rows) {
    const id = integerValue(row, masterColumns, 'employee_id');
    if (employeeById.has(id)) {
      throw new Error(`Duplicate employee ID ${id} in the master file.`);
    }

    const jobTitle = requiredValue(row, masterColumns, 'job_title');
    const departmentId = integerValue(row, masterColumns, 'department_id');
    employeePairs.push({ departmentId, jobTitle });

    const departmentName = departmentNameFromJobTitle(jobTitle);
    const existingDepartment = departments.get(departmentId);
    if (existingDepartment !== undefined && existingDepartment !== departmentName) {
      throw new Error(
        `Department ${departmentId} appears with two names: "${existingDepartment}" and "${departmentName}".`,
      );
    }
    departments.set(departmentId, departmentName);

    const branchCode = requiredValue(row, masterColumns, 'branch_code');
    const branchName = requiredValue(row, masterColumns, 'branch_name');
    const branchCity = requiredValue(row, masterColumns, 'branch_city');
    const countryCode = requiredValue(row, masterColumns, 'country_code');
    const currencyCode = requiredValue(row, masterColumns, 'local_currency');

    if (!branches.has(branchCode)) {
      const branchId = branchIds.size + 1;
      branchIds.set(branchCode, branchId);
      branches.set(branchCode, {
        id: branchId,
        branchCode,
        name: branchName,
        city: branchCity,
        countryCode,
        currencyCode,
      });
    } else {
      const branch = branches.get(branchCode) as BranchRow;
      if (
        branch.name !== branchName ||
        branch.city !== branchCity ||
        branch.countryCode !== countryCode ||
        branch.currencyCode !== currencyCode
      ) {
        throw new Error(`Branch ${branchCode} has inconsistent details in the master file.`);
      }
    }

    const employmentStatus = requiredValue(row, masterColumns, 'employment_status');
    const terminationDate = nullableValue(row, masterColumns, 'termination_date');
    const hireDate = requiredValue(row, masterColumns, 'hire_date');

    if (terminationDate !== null && terminationDate < hireDate) {
      throw new Error(`Employee ${id} terminates (${terminationDate}) before being hired (${hireDate}).`);
    }
    if (employmentStatus === 'terminated' && terminationDate === null) {
      throw new Error(`Employee ${id} is terminated but has no termination date.`);
    }
    if (employmentStatus !== 'terminated' && terminationDate !== null) {
      throw new Error(`Employee ${id} is ${employmentStatus} but carries a termination date.`);
    }

    const employee: EmployeeRow = {
      id,
      firstName: requiredValue(row, masterColumns, 'first_name'),
      lastName: requiredValue(row, masterColumns, 'last_name'),
      email: requiredValue(row, masterColumns, 'email'),
      departmentId,
      jobTitle,
      jobLevel: integerValue(row, masterColumns, 'job_level'),
      branchId: branchIds.get(branchCode) as number,
      countryCode,
      hireDate,
      terminationDate,
      employmentStatus,
      gender: requiredValue(row, masterColumns, 'gender'),
      dateOfBirth: requiredValue(row, masterColumns, 'date_of_birth'),
      workMode: requiredValue(row, masterColumns, 'work_mode'),
    };
    employees.push(employee);
    employeeById.set(id, employee);

    // Absence: a blank summary means no records at all (D-019).
    const absenceCount = nullableIntegerValue(row, masterColumns, 'absence_record_count');
    const absenceDays = nullableIntegerValue(row, masterColumns, 'total_absence_days');
    if (absenceCount === null && absenceDays === null) {
      // No absence records — no row is written.
    } else if (absenceCount === null || absenceDays === null) {
      throw new Error(`Employee ${id} has a partial absence summary.`);
    } else {
      if (absenceCount <= 0) {
        throw new Error(`Employee ${id} has an absence record count of ${absenceCount}.`);
      }
      if (absenceDays < 0) {
        throw new Error(`Employee ${id} has negative absence days.`);
      }
      absences.push({ employeeId: id, recordCount: absenceCount, totalDays: absenceDays });
    }

    // Performance: the latest review only (SEED-002).
    reviews.push({
      employeeId: id,
      reviewDate: requiredValue(row, masterColumns, 'latest_review_date'),
      rating: integerValue(row, masterColumns, 'latest_rating'),
      goalsMetPct: integerValue(row, masterColumns, 'latest_goals_met_pct'),
      promotionRecommended: booleanValue(row, masterColumns, 'latest_promotion_recommended'),
    });

    // Attrition: only for employees who left.
    const attritionDate = nullableValue(row, masterColumns, 'attrition_date');
    if (attritionDate !== null) {
      attritions.push({
        employeeId: id,
        leftOn: attritionDate,
        reason: requiredValue(row, masterColumns, 'attrition_reason'),
        voluntary: booleanValue(row, masterColumns, 'attrition_voluntary'),
        exitInterviewScore: nullableIntegerValue(row, masterColumns, 'exit_interview_score'),
      });
    }
  }

  assertDepartmentMapping(employeePairs);

  // Salary history.
  const salaryRows: SalaryRow[] = [];
  const seenEffectiveDates = new Set<string>();
  const currencyByEmployee = new Map<number, string>();

  for (const row of salaries.rows) {
    const employeeId = integerValue(row, salaryColumns, 'employee_id');
    const employee = employeeById.get(employeeId);
    if (!employee) {
      throw new Error(`Salary row references unknown employee ${employeeId}.`);
    }

    const effectiveFrom = requiredValue(row, salaryColumns, 'effective_from');
    if (effectiveFrom < employee.hireDate) {
      throw new Error(
        `Employee ${employeeId} has a salary effective ${effectiveFrom}, before hire date ${employee.hireDate}.`,
      );
    }
    if (employee.terminationDate !== null && effectiveFrom > employee.terminationDate) {
      throw new Error(
        `Employee ${employeeId} has a salary effective ${effectiveFrom}, after termination ${employee.terminationDate}.`,
      );
    }

    const key = `${employeeId}|${effectiveFrom}`;
    if (seenEffectiveDates.has(key)) {
      throw new Error(`Employee ${employeeId} has two salary rows effective ${effectiveFrom}.`);
    }
    seenEffectiveDates.add(key);

    const currencyCode = requiredValue(row, salaryColumns, 'currency');
    const knownCurrency = currencyByEmployee.get(employeeId);
    if (knownCurrency !== undefined && knownCurrency !== currencyCode) {
      throw new Error(
        `Employee ${employeeId} changes currency from ${knownCurrency} to ${currencyCode}.`,
      );
    }
    currencyByEmployee.set(employeeId, currencyCode);

    salaryRows.push({
      employeeId,
      effectiveFrom,
      baseSalary: decimalValue(row, salaryColumns, 'localized_base_salary'),
      bonusPct: decimalValue(row, salaryColumns, 'bonus_pct'),
      currencyCode,
      sourceBaseSalaryUsd: nullableDecimalValue(row, salaryColumns, 'source_base_salary_usd'),
      usdEquivalent: nullableDecimalValue(
        row,
        salaryColumns,
        'localized_base_salary_usd_equivalent',
      ),
      geoSalaryFactor: nullableDecimalValue(row, salaryColumns, 'geo_salary_factor'),
      usdToLocalFx: nullableDecimalValue(row, salaryColumns, 'usd_to_local_fx'),
      fxReferenceDate: nullableValue(row, salaryColumns, 'fx_reference_date'),
      localizationMethod: nullableValue(row, salaryColumns, 'localization_method'),
    });
  }

  for (const employee of employees) {
    if (!currencyByEmployee.has(employee.id)) {
      throw new Error(`Employee ${employee.id} has no salary record.`);
    }
  }

  return {
    departments: [...departments.entries()]
      .sort(([left], [right]) => left - right)
      .map(([id, name]) => ({ id, name })),
    branches: [...branches.values()].sort((left, right) => left.id - right.id),
    employees,
    salaries: salaryRows,
    absences,
    reviews,
    attritions,
  };
}

/**
 * Read a column from a master row that the mapping does not otherwise need.
 *
 * Exported so the verification script can cross-check the seed against the
 * source without duplicating the column names.
 */
export function masterCell(row: readonly string[], columns: ReadonlyMap<string, number>, name: string) {
  return cell(row, columns, name);
}

/**
 * Read an optional column from a master row.
 */
export function masterOptionalCell(
  row: readonly string[],
  columns: ReadonlyMap<string, number>,
  name: string,
) {
  return optionalCell(row, columns, name);
}
