import { query, queryOne } from '../db/pool.js';
import type { ClientRow, ProjectRow } from '../types/domain.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Resolve a client by id or slug. Accepting both keeps URLs readable without
 * ever trusting a display name for isolation — resolution always lands on the
 * internal uuid (edge case 3.11).
 */
export async function findClient(idOrSlug: string): Promise<ClientRow | null> {
  if (looksLikeUuid(idOrSlug)) {
    return queryOne<ClientRow>('SELECT * FROM clients WHERE id = $1', [idOrSlug]);
  }
  return queryOne<ClientRow>('SELECT * FROM clients WHERE slug = $1', [idOrSlug]);
}

export interface ClientSummary extends ClientRow {
  project_count: number;
  interaction_count: number;
  open_conflicts: number;
  last_interaction_at: Date | null;
  counts: Record<string, number>;
}

export async function listClientSummaries(): Promise<ClientSummary[]> {
  const rows = await query<
    ClientRow & {
      project_count: string;
      interaction_count: string;
      open_conflicts: string;
      last_interaction_at: Date | null;
    }
  >(`
    SELECT c.*,
      (SELECT count(*) FROM projects p WHERE p.client_id = c.id)                              AS project_count,
      (SELECT count(*) FROM interactions i WHERE i.client_id = c.id)                          AS interaction_count,
      (SELECT count(*) FROM preference_conflicts k
         WHERE k.client_id = c.id AND k.status = 'pending')                                   AS open_conflicts,
      (SELECT max(i.occurred_at) FROM interactions i WHERE i.client_id = c.id)                AS last_interaction_at
    FROM clients c
    ORDER BY c.name ASC
  `);

  const typeCounts = await query<{ client_id: string; memory_type: string; n: string }>(`
    SELECT client_id, memory_type, count(*) AS n
    FROM memory_refs
    WHERE state <> 'invalidated'
    GROUP BY client_id, memory_type
  `);

  const byClient = new Map<string, Record<string, number>>();
  for (const r of typeCounts) {
    const bucket = byClient.get(r.client_id) ?? {};
    bucket[r.memory_type] = Number(r.n);
    byClient.set(r.client_id, bucket);
  }

  return rows.map((r) => ({
    ...r,
    project_count: Number(r.project_count),
    interaction_count: Number(r.interaction_count),
    open_conflicts: Number(r.open_conflicts),
    counts: byClient.get(r.id) ?? {},
  }));
}

export async function listProjectsForClient(clientId: string): Promise<
  Array<ProjectRow & { interaction_count: number; open_conflicts: number; memory_count: number }>
> {
  const rows = await query<
    ProjectRow & { interaction_count: string; open_conflicts: string; memory_count: string }
  >(
    `SELECT p.*,
       (SELECT count(*) FROM interactions i WHERE i.project_id = p.id)                        AS interaction_count,
       (SELECT count(*) FROM preference_conflicts k
          WHERE k.project_id = p.id AND k.status = 'pending')                                 AS open_conflicts,
       (SELECT count(*) FROM memory_refs m
          WHERE m.project_id = p.id AND m.state <> 'invalidated')                             AS memory_count
     FROM projects p
     WHERE p.client_id = $1
     ORDER BY p.created_at ASC`,
    [clientId],
  );
  return rows.map((r) => ({
    ...r,
    interaction_count: Number(r.interaction_count),
    open_conflicts: Number(r.open_conflicts),
    memory_count: Number(r.memory_count),
  }));
}

/** True when a client slug is already taken. */
export async function clientSlugExists(slug: string): Promise<boolean> {
  const row = await queryOne<{ n: string }>(
    'SELECT count(*) AS n FROM clients WHERE slug = $1',
    [slug],
  );
  return Number(row?.n ?? 0) > 0;
}

export async function createClient(input: {
  slug: string;
  name: string;
  hindsightBankId: string;
  industry?: string | null;
  context?: string | null;
}): Promise<ClientRow> {
  const row = await queryOne<ClientRow>(
    `INSERT INTO clients (slug, name, hindsight_bank_id, industry, context)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.slug, input.name, input.hindsightBankId, input.industry ?? null, input.context ?? null],
  );
  if (!row) throw new Error('client insert returned no row');
  return row;
}
