import { query, queryOne } from '../db/pool.js';
import type { InteractionRow, InteractionSource, RetainStatus } from '../types/domain.js';

export async function createInteraction(input: {
  clientId: string;
  projectId: string;
  label: string;
  labelSlug: string;
  source: InteractionSource;
  content: string;
  occurredAt: Date;
  createdBy?: string | null;
}): Promise<InteractionRow> {
  const row = await queryOne<InteractionRow>(
    `INSERT INTO interactions
       (client_id, project_id, label, label_slug, source, content, occurred_at, created_by, retain_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     RETURNING *`,
    [
      input.clientId,
      input.projectId,
      input.label,
      input.labelSlug,
      input.source,
      input.content,
      input.occurredAt,
      input.createdBy ?? null,
    ],
  );
  if (!row) throw new Error('interaction insert returned no row');
  return row;
}

export async function findInteraction(id: string): Promise<InteractionRow | null> {
  return queryOne<InteractionRow>('SELECT * FROM interactions WHERE id = $1', [id]);
}

export async function listInteractions(
  projectId: string,
  options?: { limit?: number; offset?: number },
): Promise<Array<InteractionRow & { memory_count: number }>> {
  const rows = await query<InteractionRow & { memory_count: string }>(
    `SELECT i.*,
            (SELECT count(*) FROM memory_refs m
               WHERE m.interaction_id = i.id AND m.state <> 'invalidated') AS memory_count
     FROM interactions i
     WHERE i.project_id = $1
     ORDER BY i.occurred_at DESC, i.created_at DESC
     LIMIT $2 OFFSET $3`,
    [projectId, options?.limit ?? 100, options?.offset ?? 0],
  );
  return rows.map((r) => ({ ...r, memory_count: Number(r.memory_count) }));
}

export async function countInteractions(projectId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    'SELECT count(*) AS n FROM interactions WHERE project_id = $1',
    [projectId],
  );
  return Number(row?.n ?? 0);
}

export async function updateRetainStatus(
  id: string,
  status: RetainStatus,
  options?: { error?: string | null; hindsightDocumentId?: string | null },
): Promise<void> {
  await query(
    `UPDATE interactions
     SET retain_status = $2,
         retain_error = $3,
         hindsight_document_id = COALESCE($4, hindsight_document_id)
     WHERE id = $1`,
    [id, status, options?.error ?? null, options?.hindsightDocumentId ?? null],
  );
}

export async function findByProjectAndLabel(
  projectId: string,
  label: string,
): Promise<InteractionRow | null> {
  return queryOne<InteractionRow>(
    'SELECT * FROM interactions WHERE project_id = $1 AND label = $2',
    [projectId, label],
  );
}
