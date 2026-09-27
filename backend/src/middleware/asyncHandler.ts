import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wrap an async handler so a rejected promise reaches the error middleware
 * instead of becoming an unhandled rejection.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}
