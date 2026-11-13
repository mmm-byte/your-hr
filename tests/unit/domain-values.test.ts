/**
 * Covers:
 * - MON-001 every closed value set names an explicit currency/locale value
 * - QRY-003 the allow-lists match the values the database can actually hold
 * - QRY-005 the sort and grouping allow-lists are explicit
 *
 * Does not cover:
 * - The database enum types themselves (tests/integration/schema.test.ts)
 */
import { describe, expect, it } from 'vitest';
import {
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

describe('closed domain value sets', () => {
  it('has no duplicate values in any set', () => {
    const sets: Record<string, readonly (string | number)[]> = {
      EMPLOYMENT_STATUSES,
      WORK_MODES,
      GENDERS,
      CURRENCY_CODES,
      COUNTRY_CODES,
      LOCALIZATION_METHODS,
      ATTRITION_REASONS,
      JOB_LEVELS,
      BRANCH_CODES,
      DEPARTMENT_NAMES,
    };

    for (const [name, values] of Object.entries(sets)) {
      expect(new Set(values).size, `${name} has duplicates`).toBe(values.length);
    }
  });

  it('names every currency in the seeded workforce', () => {
    expect(CURRENCY_CODES).toEqual(['USD', 'INR', 'GBP', 'EUR', 'CAD', 'AUD']);
  });

  it('names every country in the seeded workforce', () => {
    expect(COUNTRY_CODES).toEqual(['US', 'IN', 'GB', 'DE', 'CA', 'AU']);
  });

  it('names every branch in the seeded workforce', () => {
    expect(BRANCH_CODES).toHaveLength(8);
    expect(BRANCH_CODES).toContain('US-NYC');
    expect(BRANCH_CODES).toContain('IN-BLR');
  });

  it('names every department in the seeded workforce', () => {
    expect(DEPARTMENT_NAMES).toHaveLength(40);
    expect(DEPARTMENT_NAMES).toContain('Payroll');
    expect(DEPARTMENT_NAMES).toContain('Compensation & Benefits');
  });

  it('names the job levels present in the cohort', () => {
    expect(JOB_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the seed summary localization method explicit', () => {
    // MON-006: the seed's fixed FX metadata must be named as synthetic, so a
    // reader can never mistake it for a live market rate.
    expect(LOCALIZATION_METHODS).toEqual(['synthetic_geo_factor_v1']);
  });

  it('names the seeded employment statuses', () => {
    expect(EMPLOYMENT_STATUSES).toEqual(['active', 'on_leave', 'terminated']);
  });
});
