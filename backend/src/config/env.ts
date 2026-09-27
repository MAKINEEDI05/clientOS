import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import path from 'node:path';

loadDotenv({ path: path.resolve(process.cwd(), '.env') });

/**
 * Environment contract.
 *
 * DATABASE_URL is required — without application metadata the app cannot run.
 *
 * HINDSIGHT_API_KEY and GROQ_API_KEY are intentionally OPTIONAL at boot so the
 * service starts in an honest degraded state rather than crash-looping. Any
 * request that depends on a missing dependency fails loudly with a specific
 * error code (see ErrorCode.MEMORY_UNAVAILABLE / LLM_UNAVAILABLE).
 *
 * There is deliberately NO fallback memory implementation. If Hindsight is not
 * configured, ClientOS reports that memory is unavailable. It never substitutes
 * PostgreSQL for Hindsight and never claims memory was used.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  HINDSIGHT_BASE_URL: z.string().url().default('https://api.hindsight.vectorize.io'),
  HINDSIGHT_API_KEY: z.string().trim().optional(),
  HINDSIGHT_TENANT_ID: z.string().trim().default('default'),

  GROQ_API_KEY: z.string().trim().optional(),
  GROQ_MODEL: z.string().trim().default('openai/gpt-oss-120b'),

  DEMO_RESET_TOKEN: z.string().trim().min(1).default('change-me-local-dev-only'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // Fail fast and loudly, but never echo values.
  console.error(`[config] Invalid environment:\n${issues}`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  /** True only when a usable Hindsight credential is present. */
  hindsightConfigured: Boolean(raw.HINDSIGHT_API_KEY && raw.HINDSIGHT_API_KEY.length > 0),
  /** True only when a usable Groq credential is present. */
  groqConfigured: Boolean(raw.GROQ_API_KEY && raw.GROQ_API_KEY.length > 0),
} as const;

export type Env = typeof env;

/** Redacted summary safe to log at boot. Never includes secret material. */
export function describeEnv(): Record<string, string | number | boolean> {
  return {
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    CORS_ORIGIN: env.CORS_ORIGIN,
    database: env.DATABASE_URL ? 'configured' : 'missing',
    hindsightBaseUrl: env.HINDSIGHT_BASE_URL,
    hindsightTenant: env.HINDSIGHT_TENANT_ID,
    hindsight: env.hindsightConfigured ? 'configured' : 'NOT CONFIGURED',
    groq: env.groqConfigured ? 'configured' : 'NOT CONFIGURED',
    groqModel: env.GROQ_MODEL,
  };
}
