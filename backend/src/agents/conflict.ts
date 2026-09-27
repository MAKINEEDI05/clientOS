import { completeJSON } from '../llm/groq.js';
import { conflictVerdictSchema } from '../llm/schemas.js';
import { CONFLICT_SYSTEM, buildConflictUser } from '../llm/prompts/conflict.prompt.js';
import { recallMemories, type RecalledMemory } from '../hindsight/recall.js';
import type { DurableCandidate } from './extract.js';
import { logger } from '../utils/logger.js';

/**
 * Preference conflict detection.
 *
 * Nothing is retained while a conflict is pending — memory does not change until
 * a human confirms the scope (PRODUCT_DECISIONS.md Decision 4).
 */

/** Minimum certainty before we interrupt the user with a conflict prompt. */
export const MIN_CONFLICT_CONFIDENCE = 0.65;

export interface DetectedConflict {
  candidate: DurableCandidate;
  oldMemory: RecalledMemory;
  explanation: string;
  confidence: number;
}

export interface ConflictDetectionInput {
  bankId: string;
  clientSlug: string;
  projectSlug: string;
  candidate: DurableCandidate;
}

/**
 * Check one candidate against existing memory.
 *
 * `factTypes` excludes `experience` deliberately: an experience is "the client
 * said X on date Y", which cannot be contradicted — it happened. Only standing
 * facts (`world`) and consolidated beliefs (`observation`) can be superseded.
 */
export async function detectConflict(
  input: ConflictDetectionInput,
): Promise<DetectedConflict | null> {
  const { bankId, clientSlug, projectSlug, candidate } = input;

  const recalled = await recallMemories({
    bankId,
    clientSlug,
    projectSlug,
    query: candidate.statement,
    budget: 'mid',
    maxTokens: 1500,
    factTypes: ['world', 'observation'],
  });

  if (recalled.length === 0) {
    logger.debug('no memories recalled for conflict check', { statement: candidate.statement });
    return null;
  }

  const verdict = await completeJSON({
    operation: 'conflict',
    system: CONFLICT_SYSTEM,
    user: buildConflictUser({
      newStatement: candidate.statement,
      memories: recalled.map((m) => ({
        id: m.id,
        text: m.text,
        memoryType: m.memoryType,
        sourceLabel: m.sourceLabel,
      })),
    }),
    schema: conflictVerdictSchema,
    temperature: 0,
    maxTokens: 500,
  });

  if (!verdict.conflicts || !verdict.oldMemoryId) return null;

  if (verdict.confidence < MIN_CONFLICT_CONFIDENCE) {
    logger.info('conflict below confidence threshold, ignored', {
      confidence: verdict.confidence,
      statement: candidate.statement,
    });
    return null;
  }

  // Anti-fabrication: the cited memory must be one we actually recalled.
  const oldMemory = recalled.find((m) => m.id === verdict.oldMemoryId);
  if (!oldMemory) {
    logger.warn('conflict cited an unknown memory id, discarded', {
      claimedId: verdict.oldMemoryId,
    });
    return null;
  }

  logger.info('preference conflict detected', {
    newStatement: candidate.statement,
    oldMemoryId: oldMemory.id,
    confidence: verdict.confidence,
  });

  return {
    candidate,
    oldMemory,
    explanation: verdict.explanation,
    confidence: verdict.confidence,
  };
}
