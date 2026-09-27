import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCode, isAppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import type { ApiFailure } from '../types/api.js';

/** 404 for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiFailure = {
    success: false,
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `No route matches ${req.method} ${req.originalUrl.split('?')[0]}`,
      requestId: req.requestId,
    },
  };
  res.status(404).json(body);
}

/**
 * Terminal error handler.
 *
 * Internal detail never reaches the client: stack traces, database messages and
 * anything carrying credentials stay in the logs. `details` is returned only for
 * validation errors, which are safe field-level messages we constructed.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  let appError: AppError;

  if (isAppError(err)) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = AppError.validation('Request validation failed.');
  } else if (err instanceof SyntaxError && 'body' in err) {
    appError = AppError.validation('Request body is not valid JSON.');
  } else if ((err as { type?: string })?.type === 'entity.too.large') {
    appError = new AppError(ErrorCode.PAYLOAD_TOO_LARGE, 'Request body is too large.', 413);
  } else {
    appError = AppError.internal();
  }

  const logFields = {
    code: appError.code,
    status: appError.status,
    path: req.originalUrl.split('?')[0],
    method: req.method,
    ...(appError.context ?? {}),
  };

  if (appError.status >= 500) {
    req.log?.error('request failed', {
      ...logFields,
      error: err instanceof Error ? err.message : String(err),
      // Stack is logged server-side only, and only outside production.
      ...(env.isProduction ? {} : { stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined }),
    });
  } else {
    req.log?.warn('request rejected', logFields);
  }

  const body: ApiFailure = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.code === ErrorCode.VALIDATION_ERROR && appError.details
        ? { details: appError.details }
        : {}),
      requestId: req.requestId,
    },
  };

  res.status(appError.status).json(body);
}
