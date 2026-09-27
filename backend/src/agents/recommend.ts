import { completeJSON, LLM_MODEL } from '../llm/groq.js';
import { recommendationOutputSchema } from '../llm/schemas.js';
import {
  RECOMMEND_SYSTEM,
  RECOMMEND_NO_MEMORY_SYSTEM,
  buildRecommendUser,
} from '../llm/prompts/recommend.prompt.js';
import { recallMemories, toEvidenceSnapshot, type RecalledMemory } from '../hindsight/recall.js';
import { orderForContext } from './classify.js';
import { bindEvidence, type BoundItem } from './evidence.js';
import type { EvidenceSnapshot } from '../types/domain.js';
import { logger } from '../utils/logger.js';

export interface RecommendInput {
  bankId: string;
  clientName: string;
  clientSlug: string;
  projectName: string;
  projectSlug: string;
  request: string;
  /** false skips recall entirely, producing an honest no-memory answer. */
  useMemory: boolean;
  pendingConflicts: Array<{ oldStatement: string; newStatement: string }>;
  activeDirectives: Array<{ content: string; scope: string }>;
}

export interface RecommendResult {
  summary: string;
  items: BoundItem[];
  avoid: BoundItem[];
  notes: string[];
  evidence: EvidenceSnapshot[];
  memoryUsed: boolean;
  memoryCount: number;
  hindsightOk: boolean;
  model: string;
  latencyMs: number;
  droppedCitations: number;
  droppedItems: number;
}

/** Cap on memories placed in the LLM context, so a long history stays workable. */
const MAX_CONTEXT_MEMORIES = 40;

/**
 * Generate a memory-aware recommendation.
 *
 * Pipeline: recall -> order -> Groq synthesis -> deterministic evidence binding.
 *
 * If `useMemory` is true and recall FAILS, the error propagates: the request fails
 * loudly rather than silently returning an answer that used no memory. That is the
 * rule from ARCHITECTURE.md §7 — never claim memory was used when it was not.
 */
export async function generateRecommendation(input: RecommendInput): Promise<RecommendResult> {
  const started = Date.now();

  let recalled: RecalledMemory[] = [];
  let hindsightOk = true;

  if (input.useMemory) {
    // Any failure here throws AppError.memoryUnavailable and is NOT swallowed.
    recalled = await recallMemories({
      bankId: input.bankId,
      clientSlug: input.clientSlug,
      projectSlug: input.projectSlug,
      query: input.request,
      budget: 'mid',
      maxTokens: 3000,
    });
  } else {
    // Explicit memory-free request (demo Scene 1). Honest, not a failure.
    hindsightOk = true;
  }

  const ordered = orderForContext(recalled).slice(0, MAX_CONTEXT_MEMORIES);
  const hasMemory = ordered.length > 0;

  const output = await completeJSON({
    operation: hasMemory ? 'recommend' : 'recommend:no-memory',
    system: hasMemory ? RECOMMEND_SYSTEM : RECOMMEND_NO_MEMORY_SYSTEM,
    user: buildRecommendUser({
      clientName: input.clientName,
      projectName: input.projectName,
      request: input.request,
      memories: ordered.map((m, i) => ({
        ref: `m${i + 1}`,
        memoryType: m.memoryType,
        sourceLabel: m.sourceLabel,
        occurredAt: m.occurredAt ?? m.mentionedAt,
        text: m.text,
      })),
      pendingConflicts: hasMemory ? input.pendingConflicts : [],
      activeDirectives: hasMemory ? input.activeDirectives : [],
    }),
    schema: recommendationOutputSchema,
    temperature: 0.3,
    maxTokens: 2000,
  });

  const bound = bindEvidence(output, ordered, toEvidenceSnapshot);

  const notes = [...bound.notes];
  if (!hasMemory) {
    const alreadySaid = notes.some((n) => /no relevant client history|no recorded history/i.test(n));
    if (!alreadySaid) {
      notes.unshift('No relevant client history was found for this request. This direction is generic.');
    }
  }

  const result: RecommendResult = {
    summary: output.summary,
    items: bound.items,
    avoid: bound.avoid,
    notes,
    evidence: ordered.map(toEvidenceSnapshot),
    memoryUsed: hasMemory,
    memoryCount: ordered.length,
    hindsightOk,
    model: LLM_MODEL,
    latencyMs: Date.now() - started,
    droppedCitations: bound.droppedCitations,
    droppedItems: bound.droppedItems,
  };

  logger.info('recommendation generated', {
    clientSlug: input.clientSlug,
    projectSlug: input.projectSlug,
    memoryUsed: result.memoryUsed,
    memoryCount: result.memoryCount,
    items: result.items.length,
    avoid: result.avoid.length,
    latencyMs: result.latencyMs,
  });

  return result;
}
