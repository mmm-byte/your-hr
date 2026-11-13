/**
 * A database seeded with the approved 10,000-person cohort.
 *
 * Purpose: let a test exercise the real workforce — the directory query, the
 * profile query, and the page components — without a database server and
 * without a separate seeding step.
 *
 * The setup is deliberately the *same* one the seed script uses: the
 * committed migration SQL is applied, and the rows come from the approved
 * dataset through `buildSeedDataset`. A test that passed here is testing the
 * real cohort, not a hand-made fixture that drifts from it.
 *
 * The `date` columns are decoded with the shared parser, so a calendar day
 * arrives as raw `YYYY-MM-DD` text exactly as it does in production
 * (RPT-004, D-021).
 *
 * Building the cohort takes a few seconds, so it is done once per test file
 * rather than once per test.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { parseCsv } from '../../scripts/csv';
import { buildSeedDataset } from '../../scripts/seed-dataset';
import { pgliteDateParsers } from '../../src/db/date-parsers';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const datasetFolder = join(projectRoot, 'Dataset');

/**
 * Insert rows using a single multi-row statement, in chunks.
 */
async function insertRows(
  client: PGlite,
  table: string,
  columns: readonly string[],
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  const columnList = columns.map((column) => `"${column}"`).join(', ');
  for (let offset = 0; offset < rows.length; offset += 500) {
    const chunk = rows.slice(offset, offset + 500);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(row[column] ?? null);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `insert into "${table}" (${columnList}) values ${tuples.join(', ')}`,
      values,
    );
  }
}

/**
 * Apply the committed migrations to a fresh database.
 */
async function applyMigrations(client: PGlite): Promise<void> {
  const migrationsFolder = join(projectRoot, 'drizzle');
  const files = (await readdir(migrationsFolder))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = await readFile(join(migrationsFolder, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed !== '') {
        await client.exec(trimmed);
      }
    }
  }
}

/**
 * Create an in-memory database holding the approved cohort.
 *
 * The caller owns the returned client and must close it.
 */
export async function createSeededDatabase(): Promise<PGlite> {
  const client = await PGlite.create(undefined, { parsers: pgliteDateParsers });

  await applyMigrations(client);

  const [masterText, salaryText] = await Promise.all([
    readFile(
      join(datasetFolder, 'hr_employee_master_10000_multicountry_final.csv'),
      'utf8',
    ),
    readFile(join(datasetFolder, 'salaries_10000_multicountry_localized_final.csv'), 'utf8'),
  ]);

  const dataset = buildSeedDataset(parseCsv(masterText), parseCsv(salaryText));

  await insertRows(
    client,
    'departments',
    ['id', 'name'],
    dataset.departments.map((row) => ({ id: row.id, name: row.name })),
  );
  await insertRows(
    client,
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
    client,
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
    client,
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
    client,
    'absence_records',
    ['employee_id', 'record_count', 'total_days'],
    dataset.absences.map((row) => ({
      employee_id: row.employeeId,
      record_count: row.recordCount,
      total_days: row.totalDays,
    })),
  );
  await insertRows(
    client,
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
    client,
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

  return client;
}
