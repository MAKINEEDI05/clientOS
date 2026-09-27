import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { logger, type Logger } from '../utils/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    log: Logger;
  }
}

/** Stamp every request with a correlation id and a child logger. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  req.log = logger.child({ requestId: req.requestId });
  res.setHeader('x-request-id', req.requestId);

  const started = Date.now();
  res.on('finish', () => {
    req.log.info('request completed', {
      method: req.method,
      // req.route is undefined for 404s; the raw path is fine and carries no secrets.
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Date.now() - started,
    });
  });

  next();
}
