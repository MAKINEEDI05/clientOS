import { query, queryOne } from '../db/pool.js';
import type {
  MemoryLinkRow,
  MemoryRefRow,
  MemoryScope,
  MemoryState,
  MemoryType,
} from '../types/domain.js';

/**
 * memory_refs is a POINTER + DISPLAY CACHE for the timeline. Hindsight remains
 * authoritative via hindsight_memory_id. Nothing in the recommendation path reads
 * memory content from here — see DATA_MODEL.md §1.1.
 */

export async function createMemoryRef(input: {
  clientId: string;
  projectId: string | null;
  interactionId: string | null;
  memoryType: MemoryType;
  statement: string;
  scope: MemoryScope;
  tags: string[];
  hindsightMemoryId?: string | null;
  hindsightDocumentId?: string | null;
  confidence?: number | null;
  sourceQuote?: string | null;
  state?: MemoryState;
}): Promise<MemoryRefRow> {
  const row = await queryOne<MemoryRefRow>(
    `INSERT INTO memory_refs
       (client_id, project_id, interaction_id, memory_type, statement, scope, tags,
        hindsight_memory_id, hindsight_document_id, confidence, source_quote, state)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      input.clientId,
      input.projectId,
      input.interactionId,
      input.memoryType,
      input.statement,
      input.scope,
      JSON.stringify(input.tags),
      input.hindsightMemoryId ?? null,
      input.hindsightDocumentId ?? null,
      input.confidence ?? null,
      input.sourceQuote ?? null,
      input.state ?? 'valid',
    ],
  );
  if (!row) throw new Error('memory_ref insert returned no row');
  return row;
}

export async function setHindsightMemoryId(refId: string, hindsightMemoryId: string): Promise<void> {
  // ON CONFLICT guard: the unique partial index rejects a duplicate mapping.
  await query(
    `UPDATE memory_refs SET hindsight_memory_id = $2
     WHERE id = $1
       AND NOT EXISTS (SELECT 1 FROM memory_refs x WHERE x.hindsight_memory_id = $2)`,
    [refId, hindsightMemoryId],
  );
}

export async function setMemoryState(refId: string, state: MemoryState): Promise<void> {
  await query('UPDATE memory_refs SET state = $2 WHERE id = $1', [refId, state]);
}

export async function appendTag(refId: string, tag: string): Promise<void> {
  await query(
    `UPDATE memory_refs
     SET tags = CASE WHEN tags @> to_jsonb($2::text) THEN tags ELSE tags || to_jsonb($2::text) END
     WHERE id = $1`,
    [refId, tag],
  );
}

export async function findMemoryRef(id: string): Promise<MemoryRefRow | null> {
  return queryOne<MemoryRefRow>('SELECT * FROM memory_refs WHERE id = $1', [id]);
}

export async function findByHindsightId(
  clientId: string,
  hindsightMemoryId: string,
): Promise<MemoryRefRow | null> {
  return queryOne<MemoryRefRow>(
    'SELECT * FROM memory_refs WHERE client_id = $1 AND hindsight_memory_id = $2',
    [clientId, hindsightMemoryId],
  );
}

function normaliseText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Token overlap between two statements, ignoring short filler words. */
function overlap(a: string, b: string): number {
  const at = new Set(normaliseText(a).split(' ').filter((w) => w.length > 3));
  const bt = new Set(normaliseText(b).split(' ').filter((w) => w.length > 3));
  if (at.size === 0 || bt.size === 0) return 0;
  let shared = 0;
  for (const t of at) if (bt.has(t)) shared += 1;
  return shared / Math.min(at.size, bt.size);
}

/**
 * Find the local pointer row that best matches a statement.
 *
 * Needed because a conflict may be detected against a Hindsight CONSOLIDATED
 * OBSERVATION, which has no memory_refs row of its own (we never retained it —
 * Hindsight derived it). Without this fallback the supersession edge would be
 * lost and the timeline could not show that the old preference was replaced.
 */
export async function findBestMatchingRef(
  clientId: string,
  projectId: string | null,
  statement: string,
  minScore = 0.5,
): Promise<MemoryRefRow | null> {
  const rows = await query<MemoryRefRow>(
    `SELECT * FROM memory_refs
     WHERE client_id = $1
       AND ($2::uuid IS NULL OR project_id = $2 OR project_id IS NULL)
       AND state = 'valid'
       AND memory_type <> 'outcome'`,
    [clientId, projectId],
  );

  let best: { row: MemoryRefRow; score: number } | null = null;
  for (const row of rows) {
    const score = overlap(statement, row.statement);
    if (!best || score > best.score) best = { row, score };
  }
  return best && best.score >= minScore ? best.row : null;
}

export interface MemoryFilters {
  type?: MemoryType;
  scope?: MemoryScope;
  state?: MemoryState;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface TimelineMemory extends MemoryRefRow {
  interaction_label: string | null;
  interaction_source: string | null;
  interaction_occurred_at: Date | null;
}

/**
 * Timeline rows for one project, including client-wide memories (project_id NULL)
 * which apply to every project for that client.
 */
export async function listProjectMemories(
  clientId: string,
  projectId: string,
  filters: MemoryFilters = {},
): Promise<TimelineMemory[]> {
  const params: unknown[] = [clientId, projectId];
  const conditions: string[] = ['m.client_id = $1', '(m.project_id = $2 OR m.project_id IS NULL)'];

  if (filters.type) {
    params.push(filters.type);
    conditions.push(`m.memory_type = $${params.length}`);
  }
  if (filters.scope) {
    params.push(filters.scope);
    conditions.push(`m.scope = $${params.length}`);
  }
  if (filters.state) {
    params.push(filters.state);
    conditions.push(`m.state = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`COALESCE(i.occurred_at, m.created_at) >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`COALESCE(i.occurred_at, m.created_at) <= $${params.length}`);
  }

  params.push(filters.limit ?? 200);
  const limitIdx = params.length;
  params.push(filters.offset ?? 0);
  const offsetIdx = params.length;

  return query<TimelineMemory>(
    `SELECT m.*,
            i.label       AS interaction_label,
            i.source      AS interaction_source,
            i.occurred_at AS interaction_occurred_at
     FROM memory_refs m
     LEFT JOIN interactions i ON i.id = m.interaction_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY COALESCE(i.occurred_at, m.created_at) ASC, m.created_at ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params,
  );
}

export async function listClientMemories(
  clientId: string,
  filters: MemoryFilters = {},
): Promise<TimelineMemory[]> {
  const params: unknown[] = [clientId];
  const conditions: string[] = ['m.client_id = $1'];

  if (filters.type) {
    params.push(filters.type);
    conditions.push(`m.memory_type = $${params.length}`);
  }
  if (filters.state) {
    params.push(filters.state);
    conditions.push(`m.state = $${params.length}`);
  }

  params.push(filters.limit ?? 200);
  const limitIdx = params.length;
  params.push(filters.offset ?? 0);
  const offsetIdx = params.length;

  return query<TimelineMemory>(
    `SELECT m.*, i.label AS interaction_label, i.source AS interaction_source,
            i.occurred_at AS interaction_occurred_at
     FROM memory_refs m
     LEFT JOIN interactions i ON i.id = m.interaction_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY COALESCE(i.occurred_at, m.created_at) ASC, m.created_at ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params,
  );
}

/** Valid statements for a project, used to suppress duplicate extraction. */
export async function listValidStatements(clientId: string, projectId: string): Promise<string[]> {
  const rows = await query<{ statement: string }>(
    `SELECT statement FROM memory_refs
     WHERE client_id = $1 AND (project_id = $2 OR project_id IS NULL) AND state = 'valid'`,
    [clientId, projectId],
  );
  return rows.map((r) => r.statement);
}

export async function createMemoryLink(input: {
  fromMemoryRefId: string;
  toMemoryRefId: string;
  relation?: string;
  scope: MemoryScope;
  conflictId?: string | null;
}): Promise<MemoryLinkRow | null> {
  return queryOne<MemoryLinkRow>(
    `INSERT INTO memory_links (from_memory_ref_id, to_memory_ref_id, relation, scope, conflict_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (from_memory_ref_id, to_memory_ref_id, relation) DO NOTHING
     RETURNING *`,
    [
      input.fromMemoryRefId,
      input.toMemoryRefId,
      input.relation ?? 'supersedes',
      input.scope,
      input.conflictId ?? null,
    ],
  );
}

export interface LinkPair {
  from_memory_ref_id: string;
  to_memory_ref_id: string;
  relation: string;
  scope: MemoryScope;
  from_statement: string;
  to_statement: string;
}

export async function listLinksForClient(clientId: string): Promise<LinkPair[]> {
  return query<LinkPair>(
    `SELECT l.from_memory_ref_id, l.to_memory_ref_id, l.relation, l.scope,
            f.statement AS from_statement, t.statement AS to_statement
     FROM memory_links l
     JOIN memory_refs f ON f.id = l.from_memory_ref_id
     JOIN memory_refs t ON t.id = l.to_memory_ref_id
     WHERE f.client_id = $1`,
    [clientId],
  );
}
