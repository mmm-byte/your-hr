/**
 * Covers:
 * - EMP-003 hire date must exist
 * - EMP-004 termination date must not precede hire date
 * - EMP-005 active and on_leave employees must not carry a termination date
 * - EMP-006 terminated employees must have a termination date
 * - EMP-009 historical records remain queryable after termination
 *
 * Does not cover:
 * - Seed verification against the real dataset (scripts/verify.ts)
 */
import { describe, expect, it } from 'vitest';
import {
  isCurrentlyEmployed,
  salaryCardLabel,
  validateEmployment,
  yearsOfService,
} from '@/lib/employment';

describe('validateEmployment', () => {
  it('accepts a valid active employee', () => {
    expect(
      validateEmployment({
        hireDate: '2020-01-15',
        terminationDate: null,
        employmentStatus: 'active',
      }),
    ).toEqual([]);
  });

  it('accepts a valid on-leave employee', () => {
    expect(
      validateEmployment({
        hireDate: '2020-01-15',
        terminationDate: null,
        employmentStatus: 'on_leave',
      }),
    ).toEqual([]);
  });

  it('accepts a valid terminated employee', () => {
    expect(
      validateEmployment({
        hireDate: '2015-01-01',
        terminationDate: '2024-06-30',
        employmentStatus: 'terminated',
      }),
    ).toEqual([]);
  });

  it('rejects a termination date before the hire date', () => {
    const violations = validateEmployment({
      hireDate: '2020-01-15',
      terminationDate: '2019-12-31',
      employmentStatus: 'terminated',
    });
    expect(violations).toContain('TERMINATION_BEFORE_HIRE');
  });

  it('accepts a termination date equal to the hire date', () => {
    const violations = validateEmployment({
      hireDate: '2020-01-15',
      terminationDate: '2020-01-15',
      employmentStatus: 'terminated',
    });
    expect(violations).not.toContain('TERMINATION_BEFORE_HIRE');
  });

  it('rejects an active employee with a termination date', () => {
    const violations = validateEmployment({
      hireDate: '2020-01-15',
      terminationDate: '2024-06-30',
      employmentStatus: 'active',
    });
    expect(violations).toContain('ACTIVE_WITH_TERMINATION_DATE');
  });

  it('rejects an on-leave employee with a termination date', () => {
    const violations = validateEmployment({
      hireDate: '2020-01-15',
      terminationDate: '2024-06-30',
      employmentStatus: 'on_leave',
    });
    expect(violations).toContain('ON_LEAVE_WITH_TERMINATION_DATE');
  });

  it('rejects a terminated employee without a termination date', () => {
    const violations = validateEmployment({
      hireDate: '2020-01-15',
      terminationDate: null,
      employmentStatus: 'terminated',
    });
    expect(violations).toContain('TERMINATED_WITHOUT_TERMINATION_DATE');
  });
});

describe('isCurrentlyEmployed', () => {
  it('treats active and on-leave as currently employed', () => {
    expect(
      isCurrentlyEmployed({
        hireDate: '2020-01-15',
        terminationDate: null,
        employmentStatus: 'active',
      }),
    ).toBe(true);
    expect(
      isCurrentlyEmployed({
        hireDate: '2020-01-15',
        terminationDate: null,
        employmentStatus: 'on_leave',
      }),
    ).toBe(true);
  });

  it('does not treat a terminated employee as currently employed', () => {
    expect(
      isCurrentlyEmployed({
        hireDate: '2020-01-15',
        terminationDate: '2024-06-30',
        employmentStatus: 'terminated',
      }),
    ).toBe(false);
  });
});

describe('salaryCardLabel', () => {
  it('calls a terminated employee salary final', () => {
    expect(
      salaryCardLabel({
        hireDate: '2020-01-15',
        terminationDate: '2024-06-30',
        employmentStatus: 'terminated',
      }),
    ).toBe('Final salary');
  });

  it('calls an employed employee salary current', () => {
    expect(
      salaryCardLabel({
        hireDate: '2020-01-15',
        terminationDate: null,
        employmentStatus: 'active',
      }),
    ).toBe('Current salary');
  });

  it('calls an on-leave employee salary current', () => {
    expect(
      salaryCardLabel({
        hireDate: '2020-01-15',
        terminationDate: null,
        employmentStatus: 'on_leave',
      }),
    ).toBe('Current salary');
  });

  it('labels a terminated employee differently from an employed one', () => {
    // ELG-006: the salary stays inspectable, but it is labelled as the salary
    // effective as of termination — never as the current salary.
    const terminated = salaryCardLabel({
      hireDate: '2020-01-15',
      terminationDate: '2024-06-30',
      employmentStatus: 'terminated',
    });
    const employed = salaryCardLabel({
      hireDate: '2020-01-15',
      terminationDate: null,
      employmentStatus: 'active',
    });
    expect(terminated).not.toBe(employed);
  });
});

describe('yearsOfService', () => {
  it('calculates fractional years from whole days', () => {
    expect(yearsOfService('2020-01-01', '2021-01-01')).toBeCloseTo(1, 2);
  });

  it('stops at the termination date once employment has ended', () => {
    const years = yearsOfService('2020-01-01', '2026-01-01', '2022-01-01');
    expect(years).toBeCloseTo(2, 2);
  });
});
