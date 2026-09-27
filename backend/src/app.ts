import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { requestContext } from './middleware/requestContext.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

/**
 * Express application, separated from the listener so tests can mount it without
 * binding a port.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const allowed = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin/curl requests have no Origin header and are allowed.
        if (!origin || allowed.includes('*') || allowed.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: false,
      allowedHeaders: ['Content-Type', 'x-demo-token', 'x-request-id'],
      exposedHeaders: ['x-request-id'],
    }),
  );

  // Bounded body size — an oversized payload is rejected before parsing.
  app.use(express.json({ limit: '256kb' }));
  app.use(requestContext);

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
