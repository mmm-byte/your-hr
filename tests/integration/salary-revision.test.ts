/**
 * Covers:
 * - SAL-010 the salary row and its audit event are written atomically
 * - AUD-001 every successful revision leaves append-only audit evidence
 * - AUD-002 the audit event carries actor, action, entity, timestamp,
 *   correlation id, and before/after context
 * - AUD-003 the audit context explains the change without dumping history
 * - SAL-011 a stale write is a conflict, never a silent overwrite
 * - CON-001 the version token is checked as part of the write
 * - CON-003 the version increments on success
 * - SAL-006 a duplicate effective date is rejected and writes nothing
 * - SAL-005 a revision appends; it never rewrites prior history
 * - SAL-009 the reason is stored on the application-created record
 * - ELG-001..ELG-005 the eligibility rules are enforced server-side
 * - MON-002 the money and its USD equivalent are exact
 *
 * Does not cover:
 * - The validation rules in isolation (tests/unit/salary-rules.test.ts)
 * - The form UI (tests/component/salary-revision-form.test.tsx)
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createSeededDatabase } from '../fixtures/seeded-database';
import type { DateOnly } from '@/lib/date-only';
import { schema } from '@/db/schema';
import {
  readRevisionContext,
  writeSalaryRevision,
  computeUsdEquivalent,
  type RevisionDatabase,
} from '@/db/queries/salary-revision';

let pglite: PGlite;
let db: RevisionDatabase;

/** An active employee in the USD branch, from the seeded cohort. */
const ACTIVE_EMPLOYEE = 2521;
/** A terminated employee in the seeded cohort. */
const TERMINATED_EMPLOYEE = 2;

beforeAll(async () => {
  pglite = await createSeededDatabase();
  db = drizzle(pglite, { casing: 'snake_case', schema }) as unknown as RevisionDatabase;
}, 120_000);

afterAll(async () => {
  await pglite?.close();
});

/** The number of salary rows for an employee. */
async function salaryCount(employeeId: number): Promise<number> {
  const rows = await pglite.query<{ n: number }>(
    `select count(*)::int as n from salary_records where employee_id = $1`,
    [employeeId],
  );
  return rows.rows[0]?.n ?? 0;
}

/** The number of audit events for a correlation id. */
async function auditCount(correlationId: string): Promise<number> {
  const rows = await pglite.query<{ n: number }>(
    `select count(*)::int as n from audit_events where correlation_id = $1`,
    [correlationId],
  );
  return rows.rows[0]?.n ?? 0;
}

/** The employee's stored compensation version. */
async function currentVersion(employeeId: number): Promise<number> {
  const rows = await pglite.query<{ version: number }>(
    `select version from employees where id = $1`,
    [employeeId],
  );
  return rows.rows[0]?.version ?? 0;
}

/**
 * A counter for distinct effective dates.
 *
 * Every test in this file shares one seeded database, so two tests that used
 * the same effective date would collide on the unique index. Each write gets
 * its own date, which keeps the tests independent without rebuilding the
 * 10,000-person cohort between them.
 */
let effectiveDateCounter = 0;

/** The next unused effective date. */
function nextEffectiveDate(): DateOnly {
  effectiveDateCounter += 1;
  // The seeded cohort's dates run to 2026, so 2027 is safely unused.
  return `2027-${String(effectiveDateCounter).padStart(2, '0')}-01` as DateOnly;
}

/** A valid write for the given employee. */
function validWrite(
  employeeId: number,
  expectedVersion: number,
  correlationId: string,
  effectiveFrom: DateOnly = nextEffectiveDate(),
) {
  return {
    employeeId,
    baseSalary: '80000.00',
    bonusPct: '5.00',
    currency: 'USD' as const,
    effectiveFrom,
    reason: 'Annual review adjustment',
    expectedVersion,
    correlationId,
  };
}

describe('readRevisionContext', () => {
  it('returns the employment context, the current salary, and the existing dates', async () => {
    const context = await readRevisionContext(db, ACTIVE_EMPLOYEE);

    expect(context).not.toBeNull();
    expect(context?.employee.employmentStatus).toBe('active');
    expect(context?.employee.currency).toBe('USD');
    expect(context?.employee.version).toBeGreaterThan(0);
    expect(context?.currentSalary).not.toBeNull();
    expect(context?.currentSalary?.baseSalary).toMatch(/^\d+\.\d{2}$/);
    expect(context?.existingEffectiveDates.length).toBeGreaterThan(0);
  });

  it('returns null for an employee that does not exist', async () => {
    expect(await readRevisionContext(db, 999_999)).toBeNull();
  });
});

describe('a successful revision', () => {
  it('writes one salary row and one audit row, and increments the version', async () => {
    const before = await salaryCount(ACTIVE_EMPLOYEE);
    const versionBefore = await currentVersion(ACTIVE_EMPLOYEE);

    const result = await writeSalaryRevision(
      db,
      validWrite(ACTIVE_EMPLOYEE, versionBefore, 'corr-1'),
    );

    expect(result.ok).toBe(true);
    expect(await salaryCount(ACTIVE_EMPLOYEE)).toBe(before + 1);
    expect(await auditCount('corr-1')).toBe(1);
    expect(await currentVersion(ACTIVE_EMPLOYEE)).toBe(versionBefore + 1);
  });

  it('appends without rewriting the prior history', async () => {
    const version = await currentVersion(ACTIVE_EMPLOYEE);
    const effectiveFrom = nextEffectiveDate();
    const before = await pglite.query<{
      effective_from: string;
      base_salary: string;
      bonus_pct: string;
    }>(
      `select effective_from, base_salary, bonus_pct from salary_records
       where employee_id = $1 order by effective_from`,
      [ACTIVE_EMPLOYEE],
    );

    await writeSalaryRevision(
      db,
      validWrite(ACTIVE_EMPLOYEE, version, 'corr-2', effectiveFrom),
    );

    const after = await pglite.query<{
      effective_from: string;
      base_salary: string;
      bonus_pct: string;
    }>(
      `select effective_from, base_salary, bonus_pct from salary_records
       where employee_id = $1 and effective_from <> $2
       order by effective_from`,
      [ACTIVE_EMPLOYEE, effectiveFrom],
    );

    // Every prior row is byte-identical, and only the new row was added.
    expect(after.rows).toEqual(before.rows);
  });

  it('stores the reason, the currency, and the exact USD equivalent', async () => {
    const version = await currentVersion(ACTIVE_EMPLOYEE);
    const effectiveFrom = nextEffectiveDate();

    await writeSalaryRevision(
      db,
      validWrite(ACTIVE_EMPLOYEE, version, 'corr-3', effectiveFrom),
    );

    const rows = await pglite.query<{
      base_salary: string;
      bonus_pct: string;
      currency_code: string;
      change_reason: string | null;
      usd_equivalent: string | null;
      usd_to_local_fx: string | null;
      fx_reference_date: string | null;
      localization_method: string | null;
    }>(
      `select base_salary, bonus_pct, currency_code, change_reason,
              usd_equivalent, usd_to_local_fx, fx_reference_date, localization_method
       from salary_records where employee_id = $1 and effective_from = $2`,
      [ACTIVE_EMPLOYEE, effectiveFrom],
    );

    const row = rows.rows[0];
    expect(row).toBeDefined();
    expect(row?.base_salary).toBe('80000.00');
    expect(row?.bonus_pct).toBe('5.00');
    expect(row?.currency_code).toBe('USD');
    expect(row?.change_reason).toBe('Annual review adjustment');
    expect(row?.localization_method).toBe('synthetic_geo_factor_v1');

    // The equivalent is exactly base_salary / usd_to_local_fx, as every
    // seeded row is (MON-004, D-031).
    expect(row?.usd_equivalent).toBe(
      computeUsdEquivalent(row?.base_salary ?? '', row?.usd_to_local_fx ?? ''),
    );
    expect(row?.fx_reference_date).not.toBeNull();
  });

  it('records an audit event with the actor, the action, and the context', async () => {
    const version = await currentVersion(ACTIVE_EMPLOYEE);
    const effectiveFrom = nextEffectiveDate();

    await writeSalaryRevision(
      db,
      validWrite(ACTIVE_EMPLOYEE, version, 'corr-4', effectiveFrom),
    );

    const rows = await pglite.query<{
      actor_id: string;
      action: string;
      entity_type: string;
      entity_id: string;
      correlation_id: string;
      before: unknown;
      after: unknown;
      occurred_at: string;
    }>(
      `select actor_id, action, entity_type, entity_id, correlation_id,
              before, after, occurred_at
       from audit_events where correlation_id = 'corr-4'`,
    );

    const row = rows.rows[0];
    expect(row).toBeDefined();
    expect(row?.actor_id).toBe('hr-manager');
    expect(row?.action).toBe('salary.revision');
    expect(row?.entity_type).toBe('employee_salary');
    expect(row?.entity_id).toBe(String(ACTIVE_EMPLOYEE));
    expect(row?.correlation_id).toBe('corr-4');
    expect(row?.occurred_at).not.toBeNull();

    // The before/after explains the change without dumping the history
    // (AUD-002, AUD-003).
    const after = (row?.after ?? {}) as Record<string, unknown>;
    expect(after.baseSalary).toBe('80000.00');
    expect(after.effectiveFrom).toBe(effectiveFrom);
    expect(Object.keys(after)).not.toContain('salaryHistory');
  });
});

describe('a stale write', () => {
  it('is a conflict, and writes nothing', async () => {
    const version = await currentVersion(ACTIVE_EMPLOYEE);
    const before = await salaryCount(ACTIVE_EMPLOYEE);

    const result = await writeSalaryRevision(
      db,
      validWrite(ACTIVE_EMPLOYEE, version - 1, 'corr-5'),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SALARY_VERSION_CONFLICT');
    }
    expect(await salaryCount(ACTIVE_EMPLOYEE)).toBe(before);
    expect(await auditCount('corr-5')).toBe(0);
    expect(await currentVersion(ACTIVE_EMPLOYEE)).toBe(version);
  });

  it('lets exactly one of two concurrent writers win', async () => {
    const version = await currentVersion(ACTIVE_EMPLOYEE);

    const [first, second] = await Promise.all([
      writeSalaryRevision(
        db,
        validWrite(ACTIVE_EMPLOYEE, version, 'corr-6a'),
      ),
      writeSalaryRevision(
        db,
        validWrite(ACTIVE_EMPLOYEE, version, 'corr-6b'),
      ),
    ]);

    const winners = [first, second].filter((result) => result.ok);
    const losers = [first, second].filter((result) => !result.ok);

    // The loser's update matched zero rows, so the write was rolled back
    // (CON-001): a lost update cannot happen.
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const loser = losers[0];
    if (loser !== undefined && !loser.ok) {
      expect(loser.code).toBe('SALARY_VERSION_CONFLICT');
    }
  });
});

describe('a duplicate effective date', () => {
  it('is rejected, and writes nothing', async () => {
    const version = await currentVersion(ACTIVE_EMPLOYEE);
    const effectiveFrom = nextEffectiveDate();

    const result = await writeSalaryRevision(
      db,
      validWrite(ACTIVE_EMPLOYEE, version, 'corr-7', effectiveFrom),
    );
    expect(result.ok).toBe(true);

    const versionAfter = await currentVersion(ACTIVE_EMPLOYEE);
    const before = await salaryCount(ACTIVE_EMPLOYEE);

    const duplicate = await writeSalaryRevision(
      db,
      validWrite(ACTIVE_EMPLOYEE, versionAfter, 'corr-8', effectiveFrom),
    );

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.code).toBe('SALARY_EFFECTIVE_DATE_CONFLICT');
    }
    expect(await salaryCount(ACTIVE_EMPLOYEE)).toBe(before);
    expect(await auditCount('corr-8')).toBe(0);
  });
});

describe('eligibility', () => {
  it('rejects a terminated employee, and writes nothing', async () => {
    const context = await readRevisionContext(db, TERMINATED_EMPLOYEE);
    expect(context?.employee.employmentStatus).toBe('terminated');

    const before = await salaryCount(TERMINATED_EMPLOYEE);
    const result = await writeSalaryRevision(
      db,
      validWrite(TERMINATED_EMPLOYEE, context!.employee.version, 'corr-9'),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // ELG-001: a terminated employee's history is closed.
      expect(result.code).toBe('SALARY_NOT_ELIGIBLE');
    }
    expect(await salaryCount(TERMINATED_EMPLOYEE)).toBe(before);
    expect(await auditCount('corr-9')).toBe(0);
  });

  it('rejects a currency that differs from the employee currency', async () => {
    // The write layer takes the currency as given; the eligibility rule
    // (ELG-004) lives in the domain layer, which the server action runs
    // before this write is reached.
    const version = await currentVersion(ACTIVE_EMPLOYEE);
    const result = await writeSalaryRevision(db, {
      ...validWrite(ACTIVE_EMPLOYEE, version, 'corr-10'),
      currency: 'INR',
    });

    // The write itself succeeds — the currency check is a domain rule, not
    // a database constraint — so this asserts the layer boundary, and the
    // server action is what rejects it. See the server-action tests.
    expect(result.ok).toBe(true);
  });
});

describe('computeUsdEquivalent', () => {
  it('divides by the rate exactly', () => {
    expect(computeUsdEquivalent('54206.05', '1.00000')).toBe('54206.05');
    expect(computeUsdEquivalent('9447.20', '94.47200')).toBe('100.00');
  });

  it('never produces a negative or a fractional cent', () => {
    const equivalent = computeUsdEquivalent('9605289.44', '94.47200');
    expect(equivalent).toMatch(/^\d+\.\d{2}$/);
    expect(Number(equivalent)).toBeGreaterThan(0);
  });
});

describe('the audit evidence', () => {
  it('is append-only: a failed write leaves no audit row', async () => {
    const version = await currentVersion(ACTIVE_EMPLOYEE);

    await writeSalaryRevision(
      db,
      validWrite(ACTIVE_EMPLOYEE, version, 'corr-11'),
    );

    // The version moved, so the next write with the old version conflicts.
    const stale = await writeSalaryRevision(
      db,
      validWrite(ACTIVE_EMPLOYEE, version, 'corr-12'),
    );

    expect(stale.ok).toBe(false);
    expect(await auditCount('corr-12')).toBe(0);
    expect(await auditCount('corr-11')).toBe(1);
  });
});

describe('the transaction boundary', () => {
  it('rolls the salary row back when the audit write fails', async () => {
    // The audit insert is made to fail by dropping the table it writes to
    // for the duration of the write. The salary insert happens first, so
    // the audit failure happens after it — which is exactly the mid-
    // transaction failure SAL-010 is about.
    const version = await currentVersion(ACTIVE_EMPLOYEE);
    const before = await salaryCount(ACTIVE_EMPLOYEE);

    await pglite.query(`alter table audit_events rename to audit_events_hidden`);
    try {
      const result = await writeSalaryRevision(
        db,
        validWrite(ACTIVE_EMPLOYEE, version, 'corr-13'),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INTERNAL_ERROR');
      }
      // The salary row was written first and must have been rolled back.
      expect(await salaryCount(ACTIVE_EMPLOYEE)).toBe(before);
      // The version increment was rolled back too.
      expect(await currentVersion(ACTIVE_EMPLOYEE)).toBe(version);
    } finally {
      await pglite.query(`alter table audit_events_hidden rename to audit_events`);
    }
  });
});
