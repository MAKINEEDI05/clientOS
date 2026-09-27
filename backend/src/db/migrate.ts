import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from './pool.js';
import { logger } from '../utils/logger.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(HERE, 'migrations');

/**
 * Forward-only migration runner. Each file is applied once inside its own
 * transaction and recorded in schema_migrations.
 */
export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  const already = new Set(rows.map((r) => r.filename));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (already.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
      logger.info('migration applied', { file });
    } catch (e) {
      await client.query('ROLLBACK');
      logger.error('migration failed', { file, error: (e as Error).message });
      throw e;
    } finally {
      client.release();
    }
  }

  return { applied, skipped };
}

// Direct invocation: `npm run db:migrate`
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then(({ applied, skipped }) => {
      console.log(`Migrations applied: ${applied.length ? applied.join(', ') : '(none)'}`);
      console.log(`Already applied:    ${skipped.length}`);
      return closePool();
    })
    .then(() => process.exit(0))
    .catch(async (e) => {
      console.error('Migration failed:', (e as Error).message);
      await closePool().catch(() => undefined);
      process.exit(1);
    });
}
