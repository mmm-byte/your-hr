/**
 * Stable error codes (D-017).
 *
 * Purpose: give every failure one fixed identifier that both the API and the UI
 * understand, so recovery behaviour is consistent and testable rather than
 * string-matched.
 *
 * Called by: server actions, route handlers, and the UI's error-state components.
 * Rules: AUD-004 (user errors are safe and generic), API-CONTRACT.md (stable
 * machine-readable codes), D-017 (the catalogue itself).
 * Tests: tests/unit/error-codes.test.ts
 *
 * The `message` on each entry is user-facing text. It must never contain a
 * stack trace, SQL, a connection string, or any internal identifier. The
 * `correlationId` carried alongside it is the only diagnostic handle the user
 * gets (AUD-004).
 */

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SALARY_EFFECTIVE_DATE_CONFLICT: 'SALARY_EFFECTIVE_DATE_CONFLICT',
  SALARY_VERSION_CONFLICT: 'SALARY_VERSION_CONFLICT',
  SALARY_NOT_ELIGIBLE: 'SALARY_NOT_ELIGIBLE',
  EMPLOYEE_NOT_FOUND: 'EMPLOYEE_NOT_FOUND',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_FILTER: 'INVALID_FILTER',
  EXPORT_NOT_AVAILABLE: 'EXPORT_NOT_AVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

interface ErrorDefinition {
  /** HTTP status for route handlers. */
  readonly status: number;
  /** Safe, plain-language message shown to the user. */
  readonly message: string;
  /** What the user can do next. `null` means there is nothing useful to offer. */
  readonly recovery: string | null;
}

export const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  VALIDATION_ERROR: {
    status: 400,
    message: 'Some of the details entered are not valid. Please check the highlighted fields.',
    recovery: 'Correct the highlighted fields and try again.',
  },
  SALARY_EFFECTIVE_DATE_CONFLICT: {
    status: 409,
    message: 'A salary revision already exists for that effective date.',
    recovery: 'Open the existing revision, or choose a different effective date.',
  },
  SALARY_VERSION_CONFLICT: {
    status: 409,
    message: "This employee's compensation changed since you opened this form.",
    recovery: 'Refresh to review the current values, then re-apply your revision.',
  },
  SALARY_NOT_ELIGIBLE: {
    status: 422,
    message: 'A salary revision cannot be created for this employee.',
    recovery: 'Review the employment status and the effective date.',
  },
  EMPLOYEE_NOT_FOUND: {
    status: 404,
    message: 'That employee could not be found.',
    recovery: 'Search the employee directory by name, ID, or email.',
  },
  NOT_FOUND: {
    status: 404,
    message: 'That page could not be found.',
    recovery: 'Return to the overview.',
  },
  INVALID_FILTER: {
    status: 400,
    message: 'One of the filters is not recognised.',
    recovery: 'The unrecognised filter was ignored. Clear the filters to start again.',
  },
  EXPORT_NOT_AVAILABLE: {
    status: 501,
    message: 'Export is not available in this build.',
    recovery: 'Remove the export option and continue with the on-screen view.',
  },
  INTERNAL_ERROR: {
    status: 500,
    message: 'Something went wrong while completing that request.',
    recovery: 'Try again. If it keeps failing, contact support with the reference below.',
  },
  DATABASE_UNAVAILABLE: {
    status: 503,
    message: 'The service is temporarily unavailable.',
    recovery: 'Try again in a moment.',
  },
};

/**
 * A failure that is safe to expose to the user.
 *
 * `fieldErrors` maps a form field name to a message. It is populated only for
 * validation failures — a conflict has no field to highlight, it has a recovery
 * path.
 */
export interface AppError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly correlationId: string;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERROR_DEFINITIONS;
}

/**
 * Build a safe, user-facing error.
 *
 * An unknown code degrades to `INTERNAL_ERROR` rather than leaking its text.
 */
export function createAppError(
  code: ErrorCode,
  options: {
    correlationId: string;
    fieldErrors?: Readonly<Record<string, string>>;
    message?: string;
  },
): AppError {
  const definition = ERROR_DEFINITIONS[code];
  return {
    code,
    message: options.message ?? definition.message,
    fieldErrors: options.fieldErrors ?? {},
    correlationId: options.correlationId,
  };
}
