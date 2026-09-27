import { extractDurableMemory, type DurableCandidate } from '../agents/extract.js';
import { detectConflict } from '../agents/conflict.js';
import * as interactionsRepo from '../repositories/interactions.repo.js';
import * as memoryRepo from '../repositories/memory.repo.js';
import * as conflictsRepo from '../repositories/conflicts.repo.js';
import type { ProjectWithClient } from '../repositories/projects.repo.js';
import { retainAndRecord } from './memory.service.js';
import { isUniqueViolation } from '../db/pool.js';
import { AppError } from '../utils/errors.js';
import { slugify } from '../utils/slug.js';
import type { InteractionRow, InteractionSource } from '../types/domain.js';
import { logger } from '../utils/logger.js';

export interface SubmitInteractionInput {
  project: ProjectWithClient;
  label: string;
  source: InteractionSource;
  content: string;
  occurredAt: Date;
  userId: string | null;
}

export interface SubmitInteractionResult {
  interaction: InteractionRow;
  extracted: Array<{
    memoryType: string;
    statement: string;
    scope: string;
    confidence: number;
    sourceQuote: string;
    retained: boolean;
    needsScopeConfirmation: boolean;
  }>;
  discarded: Array<{ text: string; reason: string }>;
  retainedCount: number;
  conflicts: Array<{
    id: string;
    newStatement: string;
    newMemoryType: string;
    oldStatement: string;
    oldMemoryId: string | null;
    explanation: string;
    confidence: number;
  }>;
  retainStatus: string;
  warnings: string[];
}

/**
 * The write path of the product.
 *
 * Records the interaction, extracts durable memory, checks each candidate for a
 * conflict with existing memory, and retains only what is unambiguous. A
 * candidate that conflicts, or whose scope could not be safely inferred, is HELD
 * as a pending conflict and nothing is written to Hindsight for it.
 */
export async function submitInteraction(
  input: SubmitInteractionInput,
): Promise<SubmitInteractionResult> {
  const { project } = input;
  const labelSlug = slugify(input.label);

  // 1. Persist the interaction first, so a downstream failure is still recoverable.
  let interaction: InteractionRow;
  try {
    interaction = await interactionsRepo.createInteraction({
      clientId: project.client_id,
      projectId: project.id,
      label: input.label,
      labelSlug,
      source: input.source,
      content: input.content,
      occurredAt: input.occurredAt,
      createdBy: input.userId,
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw AppError.conflict(
        `An interaction labelled "${input.label}" already exists for this project.`,
      );
    }
    throw e;
  }

  const documentId = `interaction:${interaction.id}`;
  const warnings: string[] = [];

  // 2. Extract durable candidates. LLM failure leaves the interaction recorded.
  let outcome: Awaited<ReturnType<typeof extractDurableMemory>>;
  try {
    const existing = await memoryRepo.listValidStatements(project.client_id, project.id);
    outcome = await extractDurableMemory({
      clientName: project.client_name,
      projectName: project.name,
      interactionLabel: input.label,
      source: input.source,
      content: input.content,
      existingStatements: existing,
    });
  } catch (e) {
    await interactionsRepo.updateRetainStatus(interaction.id, 'failed', {
      error: e instanceof AppError ? e.message : 'memory extraction failed',
    });
    throw e;
  }

  // 3. Conflict-check each candidate before anything is retained.
  const conflicts: SubmitInteractionResult['conflicts'] = [];
  const clear: DurableCandidate[] = [];

  for (const candidate of outcome.durable) {
    let detected = null;
    try {
      detected = await detectConflict({
        bankId: project.hindsight_bank_id,
        clientSlug: project.client_slug,
        projectSlug: project.slug,
        candidate,
      });
    } catch (e) {
      // Cannot verify safely -> do not retain. Silently retaining could overwrite
      // a preference we failed to check against.
      await interactionsRepo.updateRetainStatus(interaction.id, 'failed', {
        error: e instanceof AppError ? e.message : 'conflict check failed',
      });
      throw e;
    }

    if (detected) {
      // The contradicted memory may be a Hindsight-consolidated observation with
      // no pointer row of its own. Fall back to matching our own records by text
      // so the supersession edge is still recorded for the timeline.
      const oldRef =
        (detected.oldMemory.id
          ? await memoryRepo.findByHindsightId(project.client_id, detected.oldMemory.id)
          : null) ??
        (await memoryRepo.findBestMatchingRef(
          project.client_id,
          project.id,
          detected.oldMemory.text,
        ));

      const row = await conflictsRepo.createConflict({
        clientId: project.client_id,
        projectId: project.id,
        interactionId: interaction.id,
        newStatement: candidate.statement,
        newMemoryType: candidate.memoryType,
        newSourceQuote: candidate.sourceQuote,
        newConfidence: candidate.confidence,
        oldMemoryRefId: oldRef?.id ?? null,
        oldStatement: detected.oldMemory.text,
        oldHindsightMemoryId: detected.oldMemory.id,
        explanation: detected.explanation,
      });

      conflicts.push({
        id: row.id,
        newStatement: candidate.statement,
        newMemoryType: candidate.memoryType,
        oldStatement: detected.oldMemory.text,
        oldMemoryId: detected.oldMemory.id,
        explanation: detected.explanation,
        confidence: detected.confidence,
      });
      continue;
    }

    if (candidate.needsScopeConfirmation) {
      // The client implied a broad scope, or none was clear. Ask rather than guess
      // (edge cases 2.12, 5.5). Held as a conflict-shaped confirmation with no
      // contradicted memory.
      const row = await conflictsRepo.createConflict({
        clientId: project.client_id,
        projectId: project.id,
        interactionId: interaction.id,
        newStatement: candidate.statement,
        newMemoryType: candidate.memoryType,
        newSourceQuote: candidate.sourceQuote,
        newConfidence: candidate.confidence,
        oldMemoryRefId: null,
        oldStatement: '(no existing preference — scope confirmation required)',
        oldHindsightMemoryId: null,
        explanation:
          'This statement may apply beyond the current project. Confirm how widely it should apply.',
      });
      conflicts.push({
        id: row.id,
        newStatement: candidate.statement,
        newMemoryType: candidate.memoryType,
        oldStatement: '(no existing preference — scope confirmation required)',
        oldMemoryId: null,
        explanation:
          'This statement may apply beyond the current project. Confirm how widely it should apply.',
        confidence: candidate.confidence,
      });
      continue;
    }

    clear.push(candidate);
  }

  // 4. Retain the unambiguous candidates.
  let retainedCount = 0;
  const retainedStatements = new Set<string>();

  for (const candidate of clear) {
    try {
      const res = await retainAndRecord({
        bankId: project.hindsight_bank_id,
        clientId: project.client_id,
        clientSlug: project.client_slug,
        projectId: project.id,
        projectSlug: project.slug,
        interactionId: interaction.id,
        memoryType: candidate.memoryType,
        statement: candidate.statement,
        scope: candidate.scope,
        contextLabel: `${input.label} — ${input.source}`,
        sourceLabelSlug: labelSlug,
        occurredAt: input.occurredAt,
        documentId,
        confidence: candidate.confidence,
        sourceQuote: candidate.sourceQuote,
        metadata: {
          interactionId: interaction.id,
          interactionLabel: input.label,
          projectName: project.name,
        },
      });
      if (res.metadataWriteFailed) {
        warnings.push(
          'A memory was stored in the memory service but its local record could not be written. The timeline may be incomplete.',
        );
      }
      retainedCount += 1;
      retainedStatements.add(candidate.statement);
    } catch (e) {
      await interactionsRepo.updateRetainStatus(interaction.id, 'failed', {
        error: e instanceof AppError ? e.message : 'memory retain failed',
        hindsightDocumentId: documentId,
      });
      throw e;
    }
  }

  // 5. Final status reflects what actually happened.
  const status = conflicts.length > 0
    ? 'awaiting_confirmation'
    : retainedCount > 0
      ? 'retained'
      : 'not_durable';

  await interactionsRepo.updateRetainStatus(interaction.id, status, {
    hindsightDocumentId: documentId,
  });

  logger.info('interaction submitted', {
    interactionId: interaction.id,
    projectId: project.id,
    durable: outcome.durable.length,
    retained: retainedCount,
    conflicts: conflicts.length,
    discarded: outcome.discarded.length,
    status,
  });

  return {
    interaction: { ...interaction, retain_status: status as InteractionRow['retain_status'] },
    extracted: outcome.durable.map((c) => ({
      memoryType: c.memoryType,
      statement: c.statement,
      scope: c.scope,
      confidence: c.confidence,
      sourceQuote: c.sourceQuote,
      retained: retainedStatements.has(c.statement),
      needsScopeConfirmation: c.needsScopeConfirmation,
    })),
    discarded: outcome.discarded,
    retainedCount,
    conflicts,
    retainStatus: status,
    warnings,
  };
}
