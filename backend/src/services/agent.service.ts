import { generateRecommendation } from '../agents/recommend.js';
import { buildWhyLine, humaniseLabel } from '../agents/evidence.js';
import * as recommendationsRepo from '../repositories/recommendations.repo.js';
import * as conflictsRepo from '../repositories/conflicts.repo.js';
import * as directivesRepo from '../repositories/directives.repo.js';
import { retainAndRecord } from './memory.service.js';
import type { ProjectWithClient } from '../repositories/projects.repo.js';
import type { EvidenceSnapshot, RecommendationRow } from '../types/domain.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface RecommendRequestInput {
  project: ProjectWithClient;
  message: string;
  useMemory: boolean;
}

export interface RecommendResponse {
  recommendationId: string;
  memoryUsed: boolean;
  memoryCount: number;
  hindsightOk: boolean;
  summary: string;
  items: Array<{
    id: string;
    text: string;
    rationale: string;
    why: string;
    evidence: Array<EvidenceSnapshot & { sourceLabelDisplay: string | null }>;
  }>;
  avoid: Array<{
    id: string;
    text: string;
    rationale: string;
    why: string;
    evidence: Array<EvidenceSnapshot & { sourceLabelDisplay: string | null }>;
  }>;
  notes: string[];
  caveats: string[];
  model: string;
  latencyMs: number;
}

function decorateEvidence(
  evidence: EvidenceSnapshot[],
): Array<EvidenceSnapshot & { sourceLabelDisplay: string | null }> {
  return evidence.map((e) => ({
    ...e,
    sourceLabelDisplay: e.sourceLabel ? humaniseLabel(e.sourceLabel) : null,
  }));
}

/**
 * Produce a memory-aware recommendation and persist it for audit and re-open.
 *
 * When useMemory is true and recall fails, the underlying AppError propagates —
 * the request fails rather than silently returning a memoryless answer.
 */
export async function requestRecommendation(
  input: RecommendRequestInput,
): Promise<RecommendResponse> {
  const { project } = input;

  const [pending, directives] = await Promise.all([
    conflictsRepo.listConflicts({ projectId: project.id }, 'pending'),
    directivesRepo.listApplicableDirectives(project.client_id, project.id),
  ]);

  const result = await generateRecommendation({
    bankId: project.hindsight_bank_id,
    clientName: project.client_name,
    clientSlug: project.client_slug,
    projectName: project.name,
    projectSlug: project.slug,
    request: input.message,
    useMemory: input.useMemory,
    pendingConflicts: pending.map((c) => ({
      oldStatement: c.old_statement,
      newStatement: c.new_statement,
    })),
    activeDirectives: directives.map((d) => ({ content: d.content, scope: d.scope })),
  });

  const saved = await recommendationsRepo.createRecommendation({
    clientId: project.client_id,
    projectId: project.id,
    requestText: input.message,
    summary: result.summary,
    items: result.items.map((i) => ({
      id: i.id,
      text: i.text,
      rationale: i.rationale,
      evidenceMemoryIds: i.evidenceMemoryIds,
    })),
    avoid: result.avoid.map((i) => ({
      id: i.id,
      text: i.text,
      rationale: i.rationale,
      evidenceMemoryIds: i.evidenceMemoryIds,
    })),
    notes: result.notes,
    evidence: result.evidence,
    memoryUsed: result.memoryUsed,
    memoryCount: result.memoryCount,
    hindsightOk: result.hindsightOk,
    model: result.model,
    latencyMs: result.latencyMs,
  });

  const caveats = pending.map(
    (c) =>
      `Unconfirmed preference change: was "${c.old_statement}", client now says "${c.new_statement}". Confirm its scope to apply it.`,
  );

  return {
    recommendationId: saved.id,
    memoryUsed: result.memoryUsed,
    memoryCount: result.memoryCount,
    hindsightOk: result.hindsightOk,
    summary: result.summary,
    items: result.items.map((i) => ({
      id: i.id,
      text: i.text,
      rationale: i.rationale,
      why: buildWhyLine(i.evidence),
      evidence: decorateEvidence(i.evidence),
    })),
    avoid: result.avoid.map((i) => ({
      id: i.id,
      text: i.text,
      rationale: i.rationale,
      why: buildWhyLine(i.evidence),
      evidence: decorateEvidence(i.evidence),
    })),
    notes: result.notes,
    caveats,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}

/** Rehydrate a stored recommendation without re-running the LLM. */
export function presentStoredRecommendation(row: RecommendationRow): RecommendResponse {
  const byId = new Map(row.evidence.map((e) => [e.memoryId, e]));
  const hydrate = (items: RecommendationRow['items']) =>
    items.map((i) => {
      const evidence = i.evidenceMemoryIds
        .map((id) => byId.get(id))
        .filter((e): e is EvidenceSnapshot => Boolean(e));
      return {
        id: i.id,
        text: i.text,
        rationale: i.rationale,
        why: buildWhyLine(evidence),
        evidence: decorateEvidence(evidence),
      };
    });

  return {
    recommendationId: row.id,
    memoryUsed: row.memory_used,
    memoryCount: row.memory_count,
    hindsightOk: row.hindsight_ok,
    summary: row.summary,
    items: hydrate(row.items),
    avoid: hydrate(row.avoid),
    notes: row.notes,
    caveats: [],
    model: row.model,
    latencyMs: row.latency_ms ?? 0,
  };
}

export interface FeedbackInput {
  recommendationId: string;
  verdict: 'accepted' | 'rejected' | 'corrected';
  comment: string | null;
  userId: string | null;
  project: ProjectWithClient;
}

/**
 * Capture the outcome of a recommendation and retain it as an outcome memory,
 * closing the learning loop.
 */
export async function recordFeedback(
  input: FeedbackInput,
): Promise<{ feedbackId: string; retained: number; warnings: string[] }> {
  const { project } = input;
  const recommendation = await recommendationsRepo.findRecommendation(input.recommendationId);
  if (!recommendation) throw AppError.notFound('Recommendation');
  if (recommendation.project_id !== project.id) throw AppError.notFound('Recommendation');

  if (input.verdict === 'corrected' && !input.comment) {
    throw AppError.validation('A comment is required when correcting a recommendation.');
  }

  const warnings: string[] = [];
  let retainedMemoryRefId: string | null = null;
  let retained = 0;

  const statement =
    input.verdict === 'accepted'
      ? `The client team accepted the recommended direction: ${recommendation.summary.slice(0, 200)}`
      : input.verdict === 'rejected'
        ? `The client team rejected the recommended direction: ${recommendation.summary.slice(0, 200)}`
        : `The client team corrected the recommended direction: ${input.comment?.slice(0, 250)}`;

  try {
    const res = await retainAndRecord({
      bankId: project.hindsight_bank_id,
      clientId: project.client_id,
      clientSlug: project.client_slug,
      projectId: project.id,
      projectSlug: project.slug,
      interactionId: null,
      memoryType: 'outcome',
      statement,
      scope: 'project',
      contextLabel: 'Recommendation outcome',
      occurredAt: new Date(),
      documentId: `recommendation:${recommendation.id}`,
      metadata: { recommendationId: recommendation.id, verdict: input.verdict },
    });
    retainedMemoryRefId = res.memoryRefId || null;
    retained = 1;
    if (res.metadataWriteFailed) {
      warnings.push('The outcome was stored in the memory service but its local record failed.');
    }
  } catch (e) {
    // Feedback is still recorded locally; we simply do not claim memory learned it.
    warnings.push(
      e instanceof AppError
        ? e.message
        : 'The outcome could not be stored in the memory service.',
    );
    logger.warn('outcome retain failed', { recommendationId: recommendation.id });
  }

  const feedback = await recommendationsRepo.createFeedback({
    recommendationId: recommendation.id,
    verdict: input.verdict,
    comment: input.comment,
    retainedMemoryRefId,
    createdBy: input.userId,
  });

  return { feedbackId: feedback.id, retained, warnings };
}
