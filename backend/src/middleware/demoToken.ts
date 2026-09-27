import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Guards the destructive demo endpoints. Demo reset deletes Hindsight banks and
 * truncates application data, so it must not be reachable by accident.
 */
export function requireDemoToken(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.header('x-demo-token') ?? '';
  if (!provided || !safeEqual(provided, env.DEMO_RESET_TOKEN)) {
    next(AppError.unauthorized('A valid demo token is required for this operation.'));
    return;
  }
  next();
}
