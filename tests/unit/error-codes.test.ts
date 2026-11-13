/**
 * Covers:
 * - D-017 the stable error code catalogue
 * - AUD-004 user-facing errors are safe and generic
 *
 * Does not cover:
 * - The API response shape (tests/integration/health.integration.test.ts)
 */
import { describe, expect, it } from 'vitest';
import {
  createAppError,
  ERROR_CODES,
  ERROR_DEFINITIONS,
  isErrorCode,
  type ErrorCode,
} from '@/lib/error-codes';

const ALL_CODES = Object.values(ERROR_CODES);

describe('ERROR_DEFINITIONS', () => {
  it('defines an entry for every code', () => {
    for (const code of ALL_CODES) {
      expect(ERROR_DEFINITIONS[code]).toBeDefined();
    }
  });

  it('gives every code a 4xx or 5xx status', () => {
    for (const code of ALL_CODES) {
      const status = ERROR_DEFINITIONS[code].status;
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    }
  });

  it('never leaks internals in a user-facing message', () => {
    const forbidden = [
      'sql',
      'select ',
      'insert ',
      'postgres',
      'neon',
      'stack',
      'undefined',
      'null',
      'error:',
      '/src/',
      'node_modules',
    ];

    for (const code of ALL_CODES) {
      const message = ERROR_DEFINITIONS[code].message.toLowerCase();
      for (const needle of forbidden) {
        expect(message, `${code} message contains "${needle}"`).not.toContain(needle);
      }
    }
  });

  it('ends every message with punctuation so it reads as a sentence', () => {
    for (const code of ALL_CODES) {
      expect(ERROR_DEFINITIONS[code].message.trim().endsWith('.')).toBe(true);
    }
  });

  it('offers a recovery action for every code a user can act on', () => {
    const actionable: ErrorCode[] = [
      ERROR_CODES.VALIDATION_ERROR,
      ERROR_CODES.SALARY_EFFECTIVE_DATE_CONFLICT,
      ERROR_CODES.SALARY_VERSION_CONFLICT,
      ERROR_CODES.SALARY_NOT_ELIGIBLE,
      ERROR_CODES.EMPLOYEE_NOT_FOUND,
      ERROR_CODES.NOT_FOUND,
      ERROR_CODES.INVALID_FILTER,
    ];

    for (const code of actionable) {
      expect(ERROR_DEFINITIONS[code].recovery, `${code} has no recovery`).not.toBeNull();
    }
  });
});

describe('isErrorCode', () => {
  it('recognises a catalogue code', () => {
    expect(isErrorCode('VALIDATION_ERROR')).toBe(true);
  });

  it('rejects an unknown value', () => {
    expect(isErrorCode('SOMETHING_ELSE')).toBe(false);
    expect(isErrorCode(undefined)).toBe(false);
    expect(isErrorCode(null)).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });
});

describe('createAppError', () => {
  it('uses the catalogue message by default', () => {
    const error = createAppError(ERROR_CODES.VALIDATION_ERROR, { correlationId: 'ch_test' });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe(ERROR_DEFINITIONS.VALIDATION_ERROR.message);
    expect(error.correlationId).toBe('ch_test');
    expect(error.fieldErrors).toEqual({});
  });

  it('carries field errors for validation failures', () => {
    const error = createAppError(ERROR_CODES.VALIDATION_ERROR, {
      correlationId: 'ch_test',
      fieldErrors: { baseSalary: 'The base salary must be greater than zero.' },
    });
    expect(error.fieldErrors.baseSalary).toContain('greater than zero');
  });
});
