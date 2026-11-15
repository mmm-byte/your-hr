/**
 * The salary revision write path (SAL-002…SAL-011, AUD-001…AUD-003,
 * ELG-001…ELG-005, CON-001…CON-003, MON-002, D-015, D-017).
 *
 * Purpose: write one salary revision and its audit evidence **atomically**,
 * behind a concurrency check, with every rule enforced server-side.
 *
 * Called by: src/server/salary-revision.ts (the server action).
 * Reads: employees (employment context, currency, version), salary_records
 *        (the current salary, the existing effective dates, the FX
 *        provenance), branches (the employee's fixed currency).
 * Writes: salary_records (one appended row), audit_events (one appended
 *         row), employees.version (incremented by one).
 * Rules: SAL-005 (append-only), SAL-006 (no duplicate effective date),
 *        SAL-009 (a reason is required), SAL-010 (atomicity), SAL-011 (a
 *        stale write conflicts), ELG-001…ELG-005 (eligibility),
 *        CON-001…CON-003 (the version token), AUD-001…AUD-003 (audit
 *        evidence), MON-002 (money stays exact), D-015 (the driver).
 * Tests: tests/integration/salary-revision.test.ts
 *
 * Design notes
 * ------------
 * - **The transaction is the unit of work.** The salary row and its audit
 *   row are written together, so a failure in either rolls back both
 *   (SAL-010, AUD-001). The write is verified in both drivers: the Neon
 *   serverless `Pool` supports `db.transaction()` and PGlite does too.
 * - **The version check is part of the write, not a read before it.** The
 *   increment is `update employees set version = version + 1 where id = ? and
 *   version = ?`, and the affected row count decides the outcome. Two
 *   concurrent writers therefore cannot both win: the loser's update
 *   matches zero rows and the write is rolled back as a conflict
 *   (CON-001, SAL-011). A read-then-write would let both pass the check.
 * - **The FX provenance is inherited from the employee's own last record.**
 *   Every seeded salary row carries `usd_equivalent`, `usd_to_local_fx`,
 *   `fx_reference_date`, and `localization_method`, and the equivalent is
 *   exactly `base_salary / usd_to_local_fx` (MON-004, D-031). A new row
 *   inherits the same reference date and rate from the employee's most
 *   recent existing record, so the record set stays internally consistent
 *   and the salary sort keeps working. An employee with no prior record
 *   falls back to the documented fixed rates.
 * - **The equivalent is computed in exact arithmetic.** `BigInt` minor units
 *   divided by the FX rate, never a JavaScript float (MON-002).
 * - **The unique index is the last line of defence.** The database already
 *   has `salary_records_employee_effective_unique` on
 *   `(employee_id, effective_from)`. The duplicate is pre-checked so the
 *   user gets a clear message, and the constraint violation is caught so a
 *   race between two writers still produces the same error rather than a
 *   raw SQL message (SAL-006).
 * - **No raw database error escapes.** Every failure is mapped to a code
 *   from the D-017 catalogue, with a correlation id the user can quote
 *   (AUD-004).
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core/session';
import { auditEvents, branches, employees, salaryRecords, schema } from '../schema';
import type { DateOnly } from '@/lib/date-only';
import { fromMinorUnits, toMinorUnits } from '@/lib/money';
import { ERROR_CODES, type ErrorCode } from '@/lib/error-codes';
import { ASSESSMENT_ACTOR } from '@/lib/actor';
import { isEligibleForRevision } from '@/lib/salary-rules';
import type { CurrencyCodeValue, EmploymentStatus } from '@/lib/domain-values';

/**
 * A Drizzle handle for a PostgreSQL database.
 *
 * Generic over the query-result kind so the Neon serverless client and the
 * PGlite test client are both accepted. The schema generic is fixed to the
 * application's schema.
 */
export type RevisionDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/** The action recorded on the audit event for a salary revision. */
export const SALARY_REVISION_ACTION = 'salary.revision';

/** The entity type recorded on the audit event. */
export const SALARY_REVISION_ENTITY = 'employee_salary';

/**
 * The fixed FX reference rates, used only when an employee has no prior
 * salary record to inherit them from.
 *
 * These are the seed's documented synthetic rates at the fixed reference
 * date `2026-11-05` (MON-006). The values are stated here rather than
 * looked up so the fallback is deterministic; an employee with an existing
 * record never uses them.
 */
export const FALLBACK_FX_RATES: Readonly<
  Record<CurrencyCodeValue, { rate: string; referenceDate: DateOnly }>
> =
  Object.freeze({
    USD: { rate: '1.00000', referenceDate: '2026-11-05' },
    INR: { rate: '94.47200', referenceDate: '2026-11-05' },
    GBP: { rate: '0.74293', referenceDate: '2026-11-05' },
    EUR: { rate: '0.89095', referenceDate: '2026-11-05' },
    CAD: { rate: '1.39657', referenceDate: '2026-11-05' },
    AUD: { rate: '1.42847', referenceDate: '2026-11-05' },
  });

/** The FX reference date used when an employee has no prior record. */
export const FALLBACK_FX_REFERENCE_DATE: DateOnly = '2026-11-05';

/** The localization method recorded on every row. */
export const LOCALIZATION_METHOD = 'synthetic_geo_factor_v1';

/** The employment context a revision decision depends on. */
export interface RevisionEmployeeContext {
  readonly id: number;
  readonly employmentStatus: EmploymentStatus;
  readonly hireDate: DateOnly;
  readonly terminationDate: DateOnly | null;
  /** The currency fixed by the employee's branch (ELG-004). */
  readonly currency: CurrencyCodeValue;
  /** The compensation version the user was shown (CON-001). */
  readonly version: number;
}

/** Everything the revision form needs to render. */
export interface RevisionContext {
  readonly employee: RevisionEmployeeContext;
  readonly currentSalary: {
    readonly baseSalary: string;
    readonly bonusPct: string;
    readonly currencyCode: string;
    readonly effectiveFrom: DateOnly;
  } | null;
  /** The effective dates that already exist for this employee (SAL-006). */
  readonly existingEffectiveDates: readonly DateOnly[];
}

/** The write the server action asks for. */
export interface SalaryRevisionWrite {
  readonly employeeId: number;
  readonly baseSalary: string;
  readonly bonusPct: string;
  readonly currency: CurrencyCodeValue;
  readonly effectiveFrom: DateOnly;
  readonly reason: string;
  /** The version the user was shown (CON-001). */
  readonly expectedVersion: number;
  /** The correlation id carried on the audit event (AUD-002, AUD-004). */
  readonly correlationId: string;
}

/** The outcome of a write. */
export type SalaryRevisionWriteResult =
  | {
      readonly ok: true;
      /** The id of the appended salary record. */
      readonly revisionId: number;
      /** The employee's new compensation version (CON-003). */
      readonly version: number;
    }
  | {
      readonly ok: false;
      readonly code: ErrorCode;
      readonly message: string;
      readonly fieldErrors: Readonly<Record<string, string>>;
      readonly correlationId: string;
    };

/**
 * Read everything the revision form needs.
 *
 * Returns `null` when the employee does not exist, so the caller can answer
 * with a controlled not-found rather than a crash (UX-JOURNEY 4.2).
 */
export async function readRevisionContext(
  db: RevisionDatabase,
  employeeId: number,
): Promise<RevisionContext | null> {
  const rows = await db
    .select({
      id: employees.id,
      employmentStatus: employees.employmentStatus,
      hireDate: employees.hireDate,
      terminationDate: employees.terminationDate,
      version: employees.version,
      branchCurrency: branches.currencyCode,
    })
    .from(employees)
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(eq(employees.id, employeeId))
    .limit(1);

  const row = rows[0];
  if (row === undefined) {
    return null;
  }

  const salaryRows = await db
    .select({
      effectiveFrom: salaryRecords.effectiveFrom,
      baseSalary: salaryRecords.baseSalary,
      bonusPct: salaryRecords.bonusPct,
      currencyCode: salaryRecords.currencyCode,
    })
    .from(salaryRecords)
    .where(eq(salaryRecords.employeeId, employeeId))
    .orderBy(desc(salaryRecords.effectiveFrom), desc(salaryRecords.id));

  const current = salaryRows[0];

  return {
    employee: {
      id: row.id,
      employmentStatus: row.employmentStatus,
      hireDate: row.hireDate,
      terminationDate: row.terminationDate,
      currency: row.branchCurrency,
      version: row.version,
    },
    currentSalary:
      current === undefined
        ? null
        : {
            baseSalary: current.baseSalary,
            bonusPct: current.bonusPct,
            currencyCode: current.currencyCode,
            effectiveFrom: current.effectiveFrom,
          },
    existingEffectiveDates: salaryRows.map((salary) => salary.effectiveFrom),
  };
}

/**
 * The FX provenance a new record inherits.
 *
 * The employee's own most recent record is the source, so the new row
 * carries the same reference date and rate as the rows around it. An
 * employee with no prior record uses the documented fixed rates.
 */
async function resolveFxProvenance(
  db: RevisionDatabase,
  employeeId: number,
  currency: CurrencyCodeValue,
): Promise<{ rate: string; referenceDate: DateOnly }> {
  const rows = await db
    .select({
      rate: salaryRecords.usdToLocalFx,
      referenceDate: salaryRecords.fxReferenceDate,
    })
    .from(salaryRecords)
    .where(
      and(
        eq(salaryRecords.employeeId, employeeId),
        eq(salaryRecords.currencyCode, currency),
      ),
    )
    .orderBy(desc(salaryRecords.effectiveFrom), desc(salaryRecords.id))
    .limit(1);

  const inherited = rows[0];
  if (inherited !== undefined && inherited.rate !== null && inherited.referenceDate !== null) {
    return { rate: inherited.rate, referenceDate: inherited.referenceDate };
  }

  const fallback = FALLBACK_FX_RATES[currency];
  return { rate: fallback.rate, referenceDate: fallback.referenceDate };
}

/**
 * Compute the synthetic USD equivalent of a local amount.
 *
 * The relationship in the seeded data is exact: `usd_equivalent` is
 * `base_salary / usd_to_local_fx`. The division is done in `BigInt` minor
 * units and rounded **down** to the stored scale, because the seeded rows
 * were produced that way and a value that differs from its neighbours by a
 * cent would look like a data defect (MON-002, RPT-006).
 */
export function computeUsdEquivalent(baseSalary: string, fxRate: string): string {
  const salaryUnits = toMinorUnits(baseSalary);
  const rateUnits = toScaledUnits(fxRate, FX_RATE_DECIMALS, FX_RATE_SCALE);
  if (rateUnits <= 0n) {
    return fromMinorUnits(0n);
  }

  // salary / rate, at the scale both operands carry:
  //   (salaryUnits/100) / (rateUnits/100000), and the result is wanted in
  //   hundredths, so the hundredths cancel and the scale factor survives:
  //   equivalent_minor = salaryUnits * 100000 / rateUnits
  // The result is truncated to the stored scale, because the seeded rows
  // were produced that way and a value that differs from its neighbours by
  // a cent would look like a data defect (MON-002, RPT-006).
  const equivalentUnits = (salaryUnits * FX_RATE_SCALE) / rateUnits;
  return fromMinorUnits(equivalentUnits);
}

/**
 * The number of decimal places the FX rate carries.
 *
 * The column is `numeric(12,5)` and the seeded rates are written with five
 * decimals (`94.47200`), so the rate is read at that scale rather than at
 * the money scale.
 */
const FX_RATE_DECIMALS = 5;

/**
 * The multiplier for a value read at `FX_RATE_DECIMALS`.
 *
 * `94.47200` at five decimals is `9447200` units. The two constants travel
 * together: the first says how many digits the fraction has, the second says
 * what one unit is worth.
 */
const FX_RATE_SCALE = 100_000n;

/**
 * Read a decimal string at an arbitrary scale, exactly.
 *
 * `toMinorUnits` reads money at a fixed scale of two. The FX rate needs five,
 * so the fraction is padded to the requested scale and the whole part is
 * scaled up. Nothing is rounded and nothing is lost (MON-002).
 */
function toScaledUnits(value: string, decimals: number, scale: bigint): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (match === null) {
    throw new Error(`Invalid rate value: ${value}`);
  }

  const [, sign, whole, fraction = ''] = match;
  if (fraction.length > decimals) {
    throw new Error(`Rate value has too many decimal places: ${value}`);
  }

  // The fraction is padded to the scale in **digits**, so the whole part is
  // scaled by the same factor. The two together are the value at `scale`.
  const padded = fraction.padEnd(decimals, '0');
  const units = BigInt(whole as string) * scale + BigInt(padded);
  return sign === '-' ? -units : units;
}

/**
 * Write one salary revision and its audit evidence, atomically.
 *
 * The version check, the insert, the version increment, and the audit insert
 * all happen inside one transaction. A failure anywhere rolls back
 * everything (SAL-010, AUD-001).
 */
export async function writeSalaryRevision(
  db: RevisionDatabase,
  write: SalaryRevisionWrite,
): Promise<SalaryRevisionWriteResult> {
  try {
    return await db.transaction(async (tx) => {
      // **The eligibility gate is enforced here, inside the write.**
      // A terminated employee's history is closed, and the rule must hold on
      // the server even if a caller skips the domain layer (ELG-001,
      // ELG-005). The status is read inside the transaction so the check and
      // the write see the same state.
      const employment = await tx
        .select({ status: employees.employmentStatus })
        .from(employees)
        .where(eq(employees.id, write.employeeId))
        .limit(1);

      const status = employment[0]?.status;
      if (status === undefined) {
        throw new RevisionConflict(write.correlationId);
      }

      if (!isEligibleForRevision(status)) {
        throw new RevisionNotEligible(write.correlationId);
      }

      // The increment is conditional on the version still matching, so a
      // writer that lost the race updates zero rows (CON-001, SAL-011).
      const updated = await tx
        .update(employees)
        .set({ version: sql`${employees.version} + 1` })
        .where(
          and(
            eq(employees.id, write.employeeId),
            eq(employees.version, write.expectedVersion),
          ),
        )
        .returning({ version: employees.version });

      if (updated.length === 0) {
        throw new RevisionConflict(write.correlationId);
      }

      const fx = await resolveFxProvenance(
        tx as unknown as RevisionDatabase,
        write.employeeId,
        write.currency,
      );

      const inserted = await tx
        .insert(salaryRecords)
        .values({
          employeeId: write.employeeId,
          effectiveFrom: write.effectiveFrom,
          baseSalary: write.baseSalary,
          bonusPct: write.bonusPct,
          currencyCode: write.currency,
          usdEquivalent: computeUsdEquivalent(write.baseSalary, fx.rate),
          usdToLocalFx: fx.rate,
          fxReferenceDate: fx.referenceDate,
          localizationMethod: LOCALIZATION_METHOD,
          changeReason: write.reason,
        })
        .returning({ id: salaryRecords.id });

      const revisionId = inserted[0]?.id;
      if (revisionId === undefined) {
        throw new RevisionConflict(write.correlationId);
      }

      await tx.insert(auditEvents).values({
        actorId: ASSESSMENT_ACTOR.id,
        action: SALARY_REVISION_ACTION,
        entityType: SALARY_REVISION_ENTITY,
        entityId: String(write.employeeId),
        before: {
          version: write.expectedVersion,
          currency: write.currency,
        },
        after: {
          version: updated[0]?.version ?? write.expectedVersion + 1,
          baseSalary: write.baseSalary,
          bonusPct: write.bonusPct,
          currency: write.currency,
          effectiveFrom: write.effectiveFrom,
        },
        correlationId: write.correlationId,
      });

      return {
        ok: true as const,
        revisionId,
        version: updated[0]?.version ?? write.expectedVersion + 1,
      };
    });
  } catch (error) {
    return mapWriteFailure(error, write.correlationId);
  }
}

/**
 * A conflict raised inside the transaction.
 *
 * A dedicated class so the catch block can tell "the version moved" from
 * "the database refused the write" without matching on a message.
 */
class RevisionConflict extends Error {
  readonly correlationId: string;

  constructor(correlationId: string) {
    super('The compensation version changed.');
    this.name = 'RevisionConflict';
    this.correlationId = correlationId;
  }
}

/**
 * A refusal because the employee is not eligible for a revision.
 *
 * A dedicated class so the catch block can tell it from a version conflict
 * (ELG-001).
 */
class RevisionNotEligible extends Error {
  readonly correlationId: string;

  constructor(correlationId: string) {
    super('The employee is not eligible for a salary revision.');
    this.name = 'RevisionNotEligible';
    this.correlationId = correlationId;
  }
}

/**
 * Map a failure inside the transaction to a safe result.
 *
 * Nothing raw escapes: the unique-constraint violation becomes the
 * duplicate-date conflict, the version conflict becomes the version
 * conflict, and anything unexpected becomes a generic internal error with a
 * correlation id (AUD-004, D-017).
 */
function mapWriteFailure(
  error: unknown,
  correlationId: string,
): SalaryRevisionWriteResult {
  if (error instanceof RevisionConflict) {
    return {
      ok: false,
      code: ERROR_CODES.SALARY_VERSION_CONFLICT,
      message:
        "This employee's compensation changed since you opened this form.",
      fieldErrors: {},
      correlationId,
    };
  }

  if (error instanceof RevisionNotEligible) {
    return {
      ok: false,
      code: ERROR_CODES.SALARY_NOT_ELIGIBLE,
      message: 'A salary revision cannot be created for this employee.',
      fieldErrors: {},
      correlationId,
    };
  }

  if (isUniqueViolation(error)) {
    return {
      ok: false,
      code: ERROR_CODES.SALARY_EFFECTIVE_DATE_CONFLICT,
      message: 'A salary revision already exists for that effective date.',
      fieldErrors: {},
      correlationId,
    };
  }

  return {
    ok: false,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Something went wrong while completing that request.',
    fieldErrors: {},
    correlationId,
  };
}

/**
 * Whether an error is the unique-constraint violation on the salary index.
 *
 * The PostgreSQL SQLSTATE for a unique violation is `23505`, and the
 * constraint name identifies the index exactly. The code is checked rather
 * than the message, because the message is driver-specific.
 *
 * The constraint name is **required**: a `23505` with no constraint name
 * could be any unique index, and reporting an unrelated violation as a
 * duplicate effective date would send the reader after the wrong problem.
 * An unnamed violation is therefore treated as an unexpected failure.
 */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    constraint?: unknown;
    constraint_name?: unknown;
    cause?: { code?: unknown; constraint?: unknown };
  };

  const code = candidate.code ?? candidate.cause?.code;
  if (code !== '23505') {
    return false;
  }

  const constraint =
    candidate.constraint ?? candidate.constraint_name ?? candidate.cause?.constraint;

  return constraint === 'salary_records_employee_effective_unique';
}
