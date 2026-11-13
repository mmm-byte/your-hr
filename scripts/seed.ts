/**
 * Load the approved 10,000-person cohort into the target database.
 *
 * Purpose: populate the database with exactly the approved dataset, in a
 * deterministic and repeatable way.
 * Called by: `pnpm db:seed`.
 * Reads: Dataset/hr_employee_master_10000_multicountry_final.csv and
 *        Dataset/salaries_10000_multicountry_localized_final.csv.
 * Writes: departments, branches, employees, salary_records, absence_records,
 *         performance_reviews, attrition_events.
 * Rules: DATASET.md (seed policy), EMP-001…009, MON-001/002, SAL-001…007,
 *        ABS-001/002, PERF-001/002, ATT-001, SEED-001…004.
 * Tests: tests/unit/seed-dataset.test.ts, tests/integration/seed.test.ts.
 *
 * Safety properties:
 * - **Refuses an already-seeded database.** A second run stops with a clear
 *   message instead of duplicating rows. The seed never silently overwrites
 *   data (scripts/README.md → Idempotent or refuses unsafe rerun).
 * - **Runs in one transaction.** A failure part-way through leaves the
 *   database untouched rather than half-populated.
 * - **Inserts in chunks** so a 22,000-row insert does not build one
 *   enormous statement.
 * - **Validates before writing.** Every dataset invariant is checked while
 *   building the rows, so a bad source file fails before any write starts.
 *
 * The script prints counts and no row contents: salary data is sensitive by
 * design (SECURITY.md, AUD-003).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv';
import { buildSeedDataset, type SeedDataset } from './seed-dataset';
import { openDatabase, resolveDatabaseTarget, type DatabaseHandle } from './target';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const datasetFolder = join(projectRoot, 'Dataset');
const masterFile = join(datasetFolder, 'hr_employee_master_10000_multicountry_final.csv');
const salaryFile = join(datasetFolder, 'salaries_10000_multicountry_localized_final.csv');

/** Rows per INSERT statement. */
const CHUNK_SIZE = 500;

/**
 * Count rows in a table.
 */
async function countRows(target: DatabaseHandle, table: string): Promise<number> {
  const result = await target.query<{ count: number }>(
    `select count(*)::int as count from "${table}"`,
  );
  return result.rows[0]?.count ?? 0;
}

/**
 * Insert rows in chunks using one multi-row statement per chunk.
 */
async function insertRows(
  target: DatabaseHandle,
  table: string,
  columns: readonly string[],
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const columnList = columns.map((column) => `"${column}"`).join(', ');

  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(row[column] ?? null);
        // Both drivers use PostgreSQL's `$1` placeholder syntax.
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });

    await target.query(
      `insert into "${table}" (${columnList}) values ${tuples.join(', ')}`,
      values,
    );
  }

  return rows.length;
}

/**
 * Write the whole dataset.
 */
async function writeDataset(target: DatabaseHandle, dataset: SeedDataset): Promise<void> {
  await insertRows(
    target,
    'departments',
    ['id', 'name'],
    dataset.departments.map((row) => ({ id: row.id, name: row.name })),
  );

  await insertRows(
    target,
    'branches',
    ['id', 'branch_code', 'name', 'city', 'country_code', 'currency_code'],
    dataset.branches.map((row) => ({
      id: row.id,
      branch_code: row.branchCode,
      name: row.name,
      city: row.city,
      country_code: row.countryCode,
      currency_code: row.currencyCode,
    })),
  );

  await insertRows(
    target,
    'employees',
    [
      'id',
      'first_name',
      'last_name',
      'email',
      'department_id',
      'job_title',
      'job_level',
      'branch_id',
      'country_code',
      'hire_date',
      'termination_date',
      'employment_status',
      'gender',
      'date_of_birth',
      'work_mode',
    ],
    dataset.employees.map((row) => ({
      id: row.id,
      first_name: row.firstName,
      last_name: row.lastName,
      email: row.email,
      department_id: row.departmentId,
      job_title: row.jobTitle,
      job_level: row.jobLevel,
      branch_id: row.branchId,
      country_code: row.countryCode,
      hire_date: row.hireDate,
      termination_date: row.terminationDate,
      employment_status: row.employmentStatus,
      gender: row.gender,
      date_of_birth: row.dateOfBirth,
      work_mode: row.workMode,
    })),
  );

  await insertRows(
    target,
    'salary_records',
    [
      'employee_id',
      'effective_from',
      'base_salary',
      'bonus_pct',
      'currency_code',
      'source_base_salary_usd',
      'usd_equivalent',
      'geo_salary_factor',
      'usd_to_local_fx',
      'fx_reference_date',
      'localization_method',
    ],
    dataset.salaries.map((row) => ({
      employee_id: row.employeeId,
      effective_from: row.effectiveFrom,
      base_salary: row.baseSalary,
      bonus_pct: row.bonusPct,
      currency_code: row.currencyCode,
      source_base_salary_usd: row.sourceBaseSalaryUsd,
      usd_equivalent: row.usdEquivalent,
      geo_salary_factor: row.geoSalaryFactor,
      usd_to_local_fx: row.usdToLocalFx,
      fx_reference_date: row.fxReferenceDate,
      localization_method: row.localizationMethod,
    })),
  );

  await insertRows(
    target,
    'absence_records',
    ['employee_id', 'record_count', 'total_days'],
    dataset.absences.map((row) => ({
      employee_id: row.employeeId,
      record_count: row.recordCount,
      total_days: row.totalDays,
    })),
  );

  await insertRows(
    target,
    'performance_reviews',
    ['employee_id', 'review_date', 'rating', 'goals_met_pct', 'promotion_recommended'],
    dataset.reviews.map((row) => ({
      employee_id: row.employeeId,
      review_date: row.reviewDate,
      rating: row.rating,
      goals_met_pct: row.goalsMetPct,
      promotion_recommended: row.promotionRecommended,
    })),
  );

  await insertRows(
    target,
    'attrition_events',
    ['employee_id', 'left_on', 'reason', 'voluntary', 'exit_interview_score'],
    dataset.attritions.map((row) => ({
      employee_id: row.employeeId,
      left_on: row.leftOn,
      reason: row.reason,
      voluntary: row.voluntary,
      exit_interview_score: row.exitInterviewScore,
    })),
  );
}

async function main(): Promise<void> {
  console.log('Reading the approved dataset…');
  const [masterText, salaryText] = await Promise.all([
    readFile(masterFile, 'utf8'),
    readFile(salaryFile, 'utf8'),
  ]);

  const master = parseCsv(masterText);
  const salaries = parseCsv(salaryText);
  console.log(`  master rows: ${master.rows.length}, salary rows: ${salaries.rows.length}`);

  console.log('Validating the dataset…');
  const dataset = buildSeedDataset(master, salaries);
  console.log(
    `  validated: ${dataset.employees.length} employees, ${dataset.salaries.length} salary rows, ` +
      `${dataset.departments.length} departments, ${dataset.branches.length} branches, ` +
      `${dataset.absences.length} absence summaries, ${dataset.reviews.length} reviews, ` +
      `${dataset.attritions.length} attrition events`,
  );

  const target = await openDatabase(resolveDatabaseTarget());
  console.log(`Target: ${target.label}`);

  try {
    const existingEmployees = await countRows(target, 'employees');
    if (existingEmployees > 0) {
      throw new Error(
        `The target already contains ${existingEmployees} employees. ` +
          'The seed refuses to run twice; reset the database explicitly if you intend to reseed.',
      );
    }

    console.log('Writing rows…');
    await target.transaction(async (tx) => {
      await writeDataset(tx, dataset);
    });

    console.log('Seed complete.');
    console.log(
      `  employees: ${dataset.employees.length}, salary records: ${dataset.salaries.length}, ` +
        `absence summaries: ${dataset.absences.length}, reviews: ${dataset.reviews.length}, ` +
        `attrition events: ${dataset.attritions.length}`,
    );
  } finally {
    await target.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
