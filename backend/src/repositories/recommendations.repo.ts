import { query, queryOne } from '../db/pool.js';
import type { EvidenceSnapshot, RecommendationItem, RecommendationRow } from '../types/domain.js';

export async function createRecommendation(input: {
  clientId: string;
  projectId: string;
  requestText: string;
  summary: string;
  items: RecommendationItem[];
  avoid: RecommendationItem[];
  notes: string[];
  evidence: EvidenceSnapshot[];
  memoryUsed: boolean;
  memoryCount: number;
  hindsightOk: boolean;
  model: string;
  latencyMs: number | null;
}): Promise<RecommendationRow> {
  const row = await queryOne<RecommendationRow>(
    `INSERT INTO recommendations
       (client_id, project_id, request_text, summary, items, avoid, notes, evidence,
        memory_used, memory_count, hindsight_ok, model, latency_ms)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      input.clientId,
      input.projectId,
      input.requestText,
      input.summary,
      JSON.stringify(input.items),
      JSON.stringify(input.avoid),
      JSON.stringify(input.notes),
      JSON.stringify(input.evidence),
      input.memoryUsed,
      input.memoryCount,
      input.hindsightOk,
      input.model,
      input.latencyMs,
    ],
  );
  if (!row) throw new Error('recommendation insert returned no row');
  return row;
}

export async function findRecommendation(id: string): Promise<RecommendationRow | null> {
  return queryOne<RecommendationRow>('SELECT * FROM recommendations WHERE id = $1', [id]);
}

export async function listRecommendations(
  projectId: string,
  limit = 20,
): Promise<RecommendationRow[]> {
  return query<RecommendationRow>(
    `SELECT * FROM recommendations WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [projectId, limit],
  );
}

export async function createFeedback(input: {
  recommendationId: string;
  verdict: 'accepted' | 'rejected' | 'corrected';
  comment?: string | null;
  retainedMemoryRefId?: string | null;
  createdBy?: string | null;
}): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO recommendation_feedback
       (recommendation_id, verdict, comment, retained_memory_ref_id, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [
      input.recommendationId,
      input.verdict,
      input.comment ?? null,
      input.retainedMemoryRefId ?? null,
      input.createdBy ?? null,
    ],
  );
  if (!row) throw new Error('feedback insert returned no row');
  return row;
}
