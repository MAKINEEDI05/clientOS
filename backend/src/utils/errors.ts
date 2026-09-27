/**
 * Error codes surfaced to clients. Stable strings — the frontend branches on these.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  /** Hindsight is unreachable, unconfigured, or returned something unusable. */
  MEMORY_UNAVAILABLE: 'MEMORY_UNAVAILABLE',
  /** Groq is unreachable, unconfigured, timed out, or returned unusable output. */
  LLM_UNAVAILABLE: 'LLM_UNAVAILABLE',
  /** PostgreSQL is unreachable. */
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Application error carrying an HTTP status and a stable client-facing code.
 * `details` is only ever included for validation errors — never for internal faults.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCodeValue;
  readonly details?: unknown;
  /** Internal diagnostic context. Logged, never serialised to the client. */
  readonly context?: Record<string, unknown>;

  constructor(
    code: ErrorCodeValue,
    message: string,
    status: number,
    options?: { details?: unknown; context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = options?.details;
    this.context = options?.context;
    if (options?.cause !== undefined) this.cause = options.cause;
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, { details });
  }

  static notFound(what: string): AppError {
    return new AppError(ErrorCode.NOT_FOUND, `${what} not found`, 404);
  }

  static conflict(message: string): AppError {
    return new AppError(ErrorCode.CONFLICT, message, 409);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message, 401);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403);
  }

  /**
   * Memory layer failure. The message is written for end users and must never
   * imply that client history was successfully used.
   */
  static memoryUnavailable(reason: string, context?: Record<string, unknown>): AppError {
    return new AppError(
      ErrorCode.MEMORY_UNAVAILABLE,
      `Memory service unavailable. We could not safely use client history. (${reason})`,
      503,
      { context },
    );
  }

  static llmUnavailable(reason: string, context?: Record<string, unknown>): AppError {
    return new AppError(
      ErrorCode.LLM_UNAVAILABLE,
      `AI recommendation could not be generated. Please retry. (${reason})`,
      503,
      { context },
    );
  }

  static databaseUnavailable(reason: string): AppError {
    return new AppError(
      ErrorCode.DATABASE_UNAVAILABLE,
      `Application data could not be loaded. (${reason})`,
      503,
    );
  }

  static internal(message = 'An unexpected error occurred', context?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.INTERNAL, message, 500, { context });
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
