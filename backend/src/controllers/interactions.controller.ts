import type { Request, Response } from 'express';
import * as interactionsRepo from '../repositories/interactions.repo.js';
import * as projectsRepo from '../repositories/projects.repo.js';
import * as memoryRepo from '../repositories/memory.repo.js';
import { retainAndRecord } from '../services/memory.service.js';
import { extractDurableMemory } from '../agents/extract.js';
import { parseIdParam } from '../middleware/validate.js';
import { ok } from '../utils/respond.js';
import { AppError } from '../utils/errors.js';
import { slugify } from '../utils/slug.js';

/**
 * Re-run retain for an interaction whose memory write previously failed.
 *
 * Necessary because the Hindsight SDK never auto-retries writes, so a failed
 * retain is a real, user-visible state rather than something to hide.
 */
export async function postRetryRetain(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req.params.interactionId, 'Interaction');
  const interaction = await interactionsRepo.findInteraction(id);
  if (!interaction) throw AppError.notFound('Interaction');

  if (interaction.retain_status === 'retained') {
    throw AppError.conflict('This interaction has already been stored in memory.');
  }
  if (interaction.retain_status === 'awaiting_confirmation') {
    throw AppError.conflict('This interaction is waiting on a preference-change confirmation.');
  }

  const project = await projectsRepo.findProjectWithClient(interaction.project_id);
  if (!project) throw AppError.notFound('Project');

  const existing = await memoryRepo.listValidStatements(project.client_id, project.id);
  const outcome = await extractDurableMemory({
    clientName: project.client_name,
    projectName: project.name,
    interactionLabel: interaction.label,
    source: interaction.source,
    content: interaction.content,
    existingStatements: existing,
  });

  const documentId = `interaction:${interaction.id}`;
  const labelSlug = slugify(interaction.label);
  let retained = 0;

  for (const candidate of outcome.durable) {
    await retainAndRecord({
      bankId: project.hindsight_bank_id,
      clientId: project.client_id,
      clientSlug: project.client_slug,
      projectId: project.id,
      projectSlug: project.slug,
      interactionId: interaction.id,
      memoryType: candidate.memoryType,
      statement: candidate.statement,
      scope: candidate.scope,
      contextLabel: `${interaction.label} — ${interaction.source}`,
      sourceLabelSlug: labelSlug,
      occurredAt: interaction.occurred_at,
      documentId,
      confidence: candidate.confidence,
      sourceQuote: candidate.sourceQuote,
    });
    retained += 1;
  }

  const status = retained > 0 ? 'retained' : 'not_durable';
  await interactionsRepo.updateRetainStatus(interaction.id, status, {
    error: null,
    hindsightDocumentId: documentId,
  });

  ok(res, { retainStatus: status, retained, discarded: outcome.discarded });
}
