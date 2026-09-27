import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Managed Postgres providers (Neon/Render/Supabase) terminate plain connections.
  ...(/\bsslmode=require\b/.test(env.DATABASE_URL) ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on('error', (err) => {
  logger.error('postgres pool error', { error: err.message });
});

/**
 * All SQL goes through here. Values are always passed as parameters — never
 * interpolated — so the query text is fixed and injection is not possible.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  try {
    const result = await pool.query<T>(text, params as unknown[]);
    return result.rows;
  } catch (e) {
    const err = e as Error & { code?: string };
    // Surface genuine connectivity problems distinctly from constraint violations.
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '57P01', '08006', '08003'].includes(err.code ?? '')) {
      logger.error('database unavailable', { code: err.code, error: err.message });
      throw AppError.databaseUnavailable('database connection failed');
    }
    throw e;
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run a set of statements in a single transaction. Used wherever a partial write
 * would leave application metadata inconsistent with Hindsight.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('transaction rollback failed', { error: (rollbackError as Error).message });
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

/** Unique-violation detection, used to turn duplicates into 409s. */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
}
