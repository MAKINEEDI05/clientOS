import { getHindsight, toMemoryError } from './client.js';
import { clientScopeTagGroups, projectScopeTagGroups, readTag, TagPrefix } from './tags.js';
import { MEMORY_SCOPES, MEMORY_TYPES, type MemoryScope, type MemoryType } from '../types/domain.js';
import type { EvidenceSnapshot } from '../types/domain.js';
import { logger } from '../utils/logger.js';

/**
 * A recalled memory, normalised from Hindsight's RecallResult.
 *
 * Every field here traces to something Hindsight actually returned. Nothing is
 * synthesised — this is the sole source of client history for the agent.
 */
export interface RecalledMemory {
  id: string;
  text: string;
  /** Hindsight native fact type: world | experience | observation. */
  factType: string | null;
  /** ClientOS category, read back off the `type:` tag. */
  memoryType: MemoryType | 'unknown';
  scope: MemoryScope | 'unknown';
  sourceLabel: string | null;
  projectSlug: string | null;
  tags: string[];
  context: string | null;
  occurredAt: string | null;
  mentionedAt: string | null;
  /** Relative within a single query — NOT an absolute confidence. */
  finalScore: number | null;
  superseded: boolean;
}

export interface RecallOptions {
  bankId: string;
  query: string;
  /** Present for project-scoped recall; omit for client-wide recall. */
  projectSlug?: string | null;
  clientSlug: string;
  budget?: 'low' | 'mid' | 'high';
  maxTokens?: number;
  factTypes?: Array<'world' | 'experience' | 'observation'>;
  timeoutMs?: number;
}

const MEMORY_TYPE_SET = new Set<string>(MEMORY_TYPES);
const MEMORY_SCOPE_SET = new Set<string>(MEMORY_SCOPES);

/**
 * Defensive normalisation of one Hindsight result. A malformed or partial item is
 * dropped rather than allowed to reach the agent (edge case 3.14).
 */
function normalise(raw: unknown): RecalledMemory | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === 'string' ? r.id : null;
  const text = typeof r.text === 'string' ? r.text.trim() : '';
  if (!id || text.length === 0) return null;

  const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [];

  const typeFromTag = readTag(tags, TagPrefix.type);
  const scopeFromTag = readTag(tags, TagPrefix.scope);
  const scores = (r.scores ?? null) as { final?: unknown } | null;

  return {
    id,
    text,
    factType: typeof r.type === 'string' ? r.type : null,
    memoryType: typeFromTag && MEMORY_TYPE_SET.has(typeFromTag) ? (typeFromTag as MemoryType) : 'unknown',
    scope: scopeFromTag && MEMORY_SCOPE_SET.has(scopeFromTag) ? (scopeFromTag as MemoryScope) : 'unknown',
    sourceLabel: readTag(tags, TagPrefix.source),
    projectSlug: readTag(tags, TagPrefix.project),
    tags,
    context: typeof r.context === 'string' ? r.context : null,
    occurredAt: typeof r.occurred_start === 'string' ? r.occurred_start : null,
    mentionedAt: typeof r.mentioned_at === 'string' ? r.mentioned_at : null,
    finalScore: typeof scores?.final === 'number' ? scores.final : null,
    superseded: tags.includes(`${TagPrefix.status}superseded`),
  };
}

/**
 * Recall memories relevant to a query, scoped to a project (plus client-wide and
 * future-scoped memories) or to a whole client.
 *
 * Uses `tagGroups` with `any_strict` matching. The SDK's default `any` ALSO
 * returns untagged memories, which would leak other projects' memories into this
 * context — see HINDSIGHT_INTEGRATION_MAP.md §3.3.
 */
export async function recallMemories(options: RecallOptions): Promise<RecalledMemory[]> {
  const {
    bankId,
    query,
    projectSlug,
    clientSlug,
    budget = 'mid',
    maxTokens = 3000,
    factTypes,
    timeoutMs = 20_000,
  } = options;

  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await getHindsight().recall(bankId, trimmed, {
      budget,
      maxTokens,
      preferObservations: true,
      includeEntities: false,
      ...(factTypes ? { types: factTypes } : {}),
      tagGroups: projectSlug ? projectScopeTagGroups(projectSlug) : clientScopeTagGroups(clientSlug),
      signal: controller.signal,
    });

    const results = Array.isArray(response?.results) ? response.results : [];
    const normalised = results
      .map(normalise)
      .filter((m): m is RecalledMemory => m !== null)
      // A superseded memory must not influence a new recommendation, but it stays
      // on the timeline as history.
      .filter((m) => !m.superseded);

    const dropped = results.length - normalised.length;
    logger.info('hindsight recall ok', {
      bankId,
      projectSlug: projectSlug ?? null,
      returned: results.length,
      usable: normalised.length,
      ...(dropped > 0 ? { dropped } : {}),
    });

    return normalised;
  } catch (e) {
    throw toMemoryError(e, 'recall');
  } finally {
    clearTimeout(timer);
  }
}

/** Convert a recalled memory into the immutable evidence snapshot we persist. */
export function toEvidenceSnapshot(m: RecalledMemory): EvidenceSnapshot {
  return {
    memoryId: m.id,
    statement: m.text,
    memoryType: m.memoryType,
    scope: m.scope,
    sourceLabel: m.sourceLabel,
    occurredAt: m.occurredAt ?? m.mentionedAt,
    tags: m.tags,
  };
}

/**
 * List memories under one document, used to reconcile Hindsight memory ids after
 * a retain (retain itself returns no ids).
 */
export async function listMemoriesByDocument(
  bankId: string,
  documentId: string,
): Promise<Array<{ id: string; text: string; tags: string[] }>> {
  try {
    const res = await getHindsight().listMemories(bankId, { documentId, limit: 100, state: 'valid' });
    const items = (res as { memories?: unknown[]; items?: unknown[] }).memories
      ?? (res as { items?: unknown[] }).items
      ?? [];
    return (Array.isArray(items) ? items : [])
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const r = raw as Record<string, unknown>;
        const id = typeof r.id === 'string' ? r.id : null;
        const text = typeof r.text === 'string' ? r.text : '';
        if (!id) return null;
        const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [];
        return { id, text, tags };
      })
      .filter((x): x is { id: string; text: string; tags: string[] } => x !== null);
  } catch (e) {
    throw toMemoryError(e, 'listMemories');
  }
}
