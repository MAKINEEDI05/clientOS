import { queryOne } from '../db/pool.js';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  created_at: Date;
}

export const DEMO_USER_EMAIL = 'demo@clientos.local';

/**
 * Deterministic demo identity. There is no authentication in the MVP, so every
 * request acts as this single seeded user. Services take a userId argument so
 * real auth can be introduced without reshaping them.
 */
export async function ensureDemoUser(): Promise<UserRow> {
  const existing = await queryOne<UserRow>('SELECT * FROM users WHERE email = $1', [DEMO_USER_EMAIL]);
  if (existing) return existing;

  const created = await queryOne<UserRow>(
    `INSERT INTO users (email, name) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [DEMO_USER_EMAIL, 'Demo User'],
  );
  if (!created) throw new Error('failed to ensure demo user');
  return created;
}
