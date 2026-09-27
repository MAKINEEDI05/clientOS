import { env } from '../config/env.js';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Keys whose values must never reach the log, at any depth.
 */
const REDACT_KEYS = new Set([
  'apikey', 'api_key', 'authorization', 'password', 'token', 'secret',
  'hindsight_api_key', 'groq_api_key', 'database_url', 'connectionstring',
  'demo_reset_token', 'cookie', 'set-cookie',
]);

const MAX_STRING = 300;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Defence in depth: never let a key-shaped string through even if the field name is innocent.
    if (/^(hsk_|gsk_|sk-)/i.test(value)) return '[redacted]';
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[${value.length} chars]` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function emit(level: Level, message: string, fields?: Record<string, unknown>): void {
  if (ORDER[level] < ORDER[env.LOG_LEVEL]) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  };
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  out(JSON.stringify(line));
}

export const logger = {
  debug: (m: string, f?: Record<string, unknown>) => emit('debug', m, f),
  info: (m: string, f?: Record<string, unknown>) => emit('info', m, f),
  warn: (m: string, f?: Record<string, unknown>) => emit('warn', m, f),
  error: (m: string, f?: Record<string, unknown>) => emit('error', m, f),
  /** Child logger that stamps every line with the same correlation fields. */
  child(base: Record<string, unknown>) {
    return {
      debug: (m: string, f?: Record<string, unknown>) => emit('debug', m, { ...base, ...f }),
      info: (m: string, f?: Record<string, unknown>) => emit('info', m, { ...base, ...f }),
      warn: (m: string, f?: Record<string, unknown>) => emit('warn', m, { ...base, ...f }),
      error: (m: string, f?: Record<string, unknown>) => emit('error', m, { ...base, ...f }),
    };
  },
};

export type Logger = ReturnType<typeof logger.child>;
/** Exported for unit testing the redaction rules. */
export const __redactForTest = redact;
