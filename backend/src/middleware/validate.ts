import type { Request } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';

/**
 * Validate and narrow a request payload. On failure the client receives a 400
 * with field-level details — the only case where `details` is ever returned.
 */
export function parseBody<T>(schema: z.ZodType<T>, req: Request): T {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw AppError.validation(
      'Request body is invalid.',
      result.error.issues.map((i) => ({
        field: i.path.join('.') || '(root)',
        message: i.message,
      })),
    );
  }
  return result.data;
}

export function parseQuery<T>(schema: z.ZodType<T>, req: Request): T {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw AppError.validation(
      'Query parameters are invalid.',
      result.error.issues.map((i) => ({
        field: i.path.join('.') || '(root)',
        message: i.message,
      })),
    );
  }
  return result.data;
}

/** Route params are always strings; this guards length and shape. */
export const idParamSchema = z
  .string()
  .trim()
  .min(1, 'Identifier is required')
  .max(120, 'Identifier is too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'Identifier contains invalid characters');

export function parseIdParam(value: string | undefined, what: string): string {
  const result = idParamSchema.safeParse(value ?? '');
  if (!result.success) {
    throw AppError.validation(`${what} identifier is invalid.`);
  }
  return result.data;
}
