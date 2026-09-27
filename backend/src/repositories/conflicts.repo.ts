import { query, queryOne } from '../db/pool.js';
import type { ConflictRow, ConflictScope, ConflictStatus, MemoryType } from '../types/domain.js';

export async function createConflict(input: {
  clientId: string;
  projectId: string;
  interactionId: string | null;
  newStatement: string;
  newMemoryType: MemoryType;
  newSourceQuote?: string | null;
  newConfidence?: number | null;
  oldMemoryRefId: string | null;
  oldStatement: string;
  oldHindsightMemoryId: string | null;
  explanation: string;
}): Promise<ConflictRow> {
  const row = await queryOne<ConflictRow>(
    `INSERT INTO preference_conflicts
       (client_id, project_id, interaction_id, new_statement, new_memory_type, new_source_quote,
        new_confidence, old_memory_ref_id, old_statement, old_hindsight_memory_id, explanation)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      input.clientId,
      input.projectId,
      input.interactionId,
      input.newStatement,
      input.newMemoryType,
      input.newSourceQuote ?? null,
      input.newConfidence ?? null,
      input.oldMemoryRefId,
      input.oldStatement,
      input.oldHindsightMemoryId,
      input.explanation,
    ],
  );
  if (!row) throw new Error('conflict insert returned no row');
  return row;
}

export async function findConflict(id: string): Promise<ConflictRow | null> {
  return queryOne<ConflictRow>('SELECT * FROM preference_conflicts WHERE id = $1', [id]);
}

export interface ConflictWithContext extends ConflictRow {
  interaction_label: string | null;
  project_slug: string;
  project_name: string;
  client_slug: string;
  client_name: string;
  hindsight_bank_id: string;
}

export async function findConflictWithContext(id: string): Promise<ConflictWithContext | null> {
  return queryOne<ConflictWithContext>(
    `SELECT k.*, i.label AS interaction_label,
            p.slug AS project_slug, p.name AS project_name,
            c.slug AS client_slug, c.name AS client_name, c.hindsight_bank_id
     FROM preference_conflicts k
     JOIN projects p ON p.id = k.project_id
     JOIN clients  c ON c.id = k.client_id
     LEFT JOIN interactions i ON i.id = k.interaction_id
     WHERE k.id = $1`,
    [id],
  );
}

export async function listConflicts(
  scope: { projectId?: string; clientId?: string },
  status: ConflictStatus | 'all' = 'pending',
): Promise<Array<ConflictRow & { interaction_label: string | null }>> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (scope.projectId) {
    params.push(scope.projectId);
    conditions.push(`k.project_id = $${params.length}`);
  }
  if (scope.clientId) {
    params.push(scope.clientId);
    conditions.push(`k.client_id = $${params.length}`);
  }
  if (status !== 'all') {
    params.push(status);
    conditions.push(`k.status = $${params.length}`);
  }

  return query<ConflictRow & { interaction_label: string | null }>(
    `SELECT k.*, i.label AS interaction_label
     FROM preference_conflicts k
     LEFT JOIN interactions i ON i.id = k.interaction_id
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY k.created_at DESC`,
    params,
  );
}

/**
 * Atomically claim a pending conflict for resolution.
 *
 * The WHERE status='pending' clause makes this idempotent under double-submit:
 * the second call updates zero rows and the caller returns 409 rather than
 * writing memory twice (edge cases 3.4, 7.9).
 */
export async function claimConflict(
  id: string,
  input: {
    resolution: 'new_preference' | 'keep_existing' | 'dismissed';
    scope: ConflictScope | null;
    resolvedBy?: string | null;
  },
): Promise<ConflictRow | null> {
  return queryOne<ConflictRow>(
    `UPDATE preference_conflicts
     SET status = $2, resolution = $3, resolved_scope = $4, resolved_by = $5, resolved_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [
      id,
      input.resolution === 'dismissed' ? 'dismissed' : 'resolved',
      input.resolution,
      input.scope,
      input.resolvedBy ?? null,
    ],
  );
}

export async function countPending(projectId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*) AS n FROM preference_conflicts WHERE project_id = $1 AND status = 'pending'`,
    [projectId],
  );
  return Number(row?.n ?? 0);
}
