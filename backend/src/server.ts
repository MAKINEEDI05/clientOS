import { createApp } from './app.js';
import { env, describeEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { checkDatabase, closePool } from './db/pool.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('ClientOS backend listening', { port: env.PORT, ...describeEnv() });

  // Surface a degraded configuration loudly at boot rather than at demo time.
  if (!env.hindsightConfigured) {
    logger.warn(
      'HINDSIGHT_API_KEY is not set — memory operations will fail with MEMORY_UNAVAILABLE. ' +
        'ClientOS does not substitute a local memory store.',
    );
  }
  if (!env.groqConfigured) {
    logger.warn('GROQ_API_KEY is not set — agent operations will fail with LLM_UNAVAILABLE.');
  }

  void checkDatabase().then((ok) => {
    if (!ok) logger.error('database is not reachable at startup');
  });
});

async function shutdown(signal: string): Promise<void> {
  logger.info('shutting down', { signal });
  server.close(() => {
    void closePool().finally(() => process.exit(0));
  });
  // Do not hang forever on in-flight requests.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled rejection', { error: reason instanceof Error ? reason.message : String(reason) });
});
