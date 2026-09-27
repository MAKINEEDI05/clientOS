import * as conflictsRepo from '../repositories/conflicts.repo.js';
import * as memoryRepo from '../repositories/memory.repo.js';
import * as directivesRepo from '../repositories/directives.repo.js';
import * as interactionsRepo from '../repositories/interactions.repo.js';
import { retainAndRecord } from './memory.service.js';
import { createScopedDirective } from '../hindsight/directives.js';
import { invalidateMemory } from '../hindsight/curate.js';
import { SUPERSEDED_TAG } from '../hindsight/tags.js';
import { AppError } from '../utils/errors.js';
import { slugify } from '../utils/slug.js';
import type { ConflictScope, MemoryScope } from '../types/domain.js';
import { logger } from '../utils/logger.js';

export interface ResolveConflictInput {
  conflictId: string;
  resolution: 'new_preference' | 'keep_existing' | 'dismissed';
  scope: ConflictScope | null;
  userId: string | null;
}

export interface ResolveConflictResult {
  conflictId: string;
  status: string;
  resolvedScope: ConflictScope | null;
  newMemory: { memoryRefId: string; hindsightMemoryId: string | null; statement: string; scope: MemoryScope } | null;
  supersededMemory: { memoryRefId: string | null; statement: string; state: string } | null;
  directive: { id: string; scope: 'project' | 'client' } | null;
  warnings: string[];
}

/** Scope chosen in the UI -> the scope tag actually written. */
function toMemoryScope(scope: ConflictScope): MemoryScope {
  switch (scope) {
    case 'interaction': return 'interaction';
    case 'project': return 'project';
    case 'client': return 'client';
    case 'future': return 'future';
  }
}

/**
 * Resolve a preference conflict.
 *
 * Three branches, differing in how widely the new preference binds:
 *
 *  interaction  temporary exception — a plain narrow memory. No directive, and the
 *               old memory is untouched, so one exception cannot become a rule.
 *
 *  project      new memory at project scope + a PROJECT-TAGGED Hindsight directive.
 *               The old memory stays VALID because it is still true for the
 *               client's other projects; it is only marked superseded here.
 *
 *  client/future new memory at client scope + a CLIENT-TAGGED directive, and the
 *               old memory is INVALIDATED in Hindsight — removed from recall but
 *               kept auditable and restorable.
 *
 * No branch deletes anything.
 */
export async function resolveConflict(input: ResolveConflictInput): Promise<ResolveConflictResult> {
  const conflict = await conflictsRepo.findConflictWithContext(input.conflictId);
  if (!conflict) throw AppError.notFound('Conflict');

  if (conflict.status !== 'pending') {
    throw AppError.conflict('This preference change has already been resolved.');
  }

  if (input.resolution === 'new_preference' && !input.scope) {
    throw AppError.validation('A scope is required when confirming a new preference.');
  }

  // Atomically claim it. A concurrent double-submit updates zero rows here.
  const claimed = await conflictsRepo.claimConflict(input.conflictId, {
    resolution: input.resolution,
    scope: input.resolution === 'new_preference' ? input.scope : null,
    resolvedBy: input.userId,
  });
  if (!claimed) {
    throw AppError.conflict('This preference change has already been resolved.');
  }

  const warnings: string[] = [];

  // Keep-existing / dismissed: close it out, write no memory.
  if (input.resolution !== 'new_preference') {
    if (conflict.interaction_id) {
      await interactionsRepo.updateRetainStatus(conflict.interaction_id, 'not_durable', { error: null });
    }
    logger.info('conflict closed without new memory', {
      conflictId: conflict.id,
      resolution: input.resolution,
    });
    return {
      conflictId: conflict.id,
      status: claimed.status,
      resolvedScope: null,
      newMemory: null,
      supersededMemory: conflict.old_memory_ref_id
        ? { memoryRefId: conflict.old_memory_ref_id, statement: conflict.old_statement, state: 'valid' }
        : null,
      directive: null,
      warnings,
    };
  }

  const scope = input.scope as ConflictScope;
  const memoryScope = toMemoryScope(scope);
  const isBroad = scope === 'client' || scope === 'future';

  // 1. Retain the confirmed preference in Hindsight.
  const interaction = conflict.interaction_id
    ? await interactionsRepo.findInteraction(conflict.interaction_id)
    : null;

  const retained = await retainAndRecord({
    bankId: conflict.hindsight_bank_id,
    clientId: conflict.client_id,
    clientSlug: conflict.client_slug,
    // Client/future-scoped memory is deliberately not bound to one project.
    projectId: isBroad ? null : conflict.project_id,
    projectSlug: isBroad ? null : conflict.project_slug,
    interactionId: conflict.interaction_id,
    memoryType: 'preference_change',
    statement: conflict.new_statement,
    scope: memoryScope,
    contextLabel: conflict.interaction_label
      ? `${conflict.interaction_label} — confirmed preference change`
      : 'Confirmed preference change',
    sourceLabelSlug: conflict.interaction_label ? slugify(conflict.interaction_label) : null,
    occurredAt: interaction?.occurred_at ?? new Date(),
    documentId: conflict.interaction_id ? `interaction:${conflict.interaction_id}` : `conflict:${conflict.id}`,
    confidence: conflict.new_confidence ? Number(conflict.new_confidence) : null,
    sourceQuote: conflict.new_source_quote,
    metadata: {
      conflictId: conflict.id,
      supersedes: conflict.old_statement.slice(0, 200),
      confirmedScope: scope,
    },
  });

  if (retained.metadataWriteFailed) {
    warnings.push(
      'The preference was stored in the memory service but its local record could not be written.',
    );
  }

  // 2. Tag-scoped directive, so the confirmed change binds exactly where chosen.
  //    A temporary exception gets no directive by design.
  let directive: { id: string; scope: 'project' | 'client' } | null = null;
  if (scope !== 'interaction') {
    const directiveScope: 'project' | 'client' = isBroad ? 'client' : 'project';
    try {
      const created = await createScopedDirective({
        bankId: conflict.hindsight_bank_id,
        name: `clientos-${slugify(conflict.new_statement).slice(0, 40)}-${conflict.id.slice(0, 8)}`,
        content:
          `${conflict.new_statement} This supersedes the earlier preference: "${conflict.old_statement}".` +
          (directiveScope === 'project'
            ? ` This applies only to the project "${conflict.project_name}".`
            : ' This applies to all work for this client.'),
        scope: directiveScope,
        clientSlug: conflict.client_slug,
        projectSlug: conflict.project_slug,
        priority: 10,
      });

      if (created.id) {
        await directivesRepo.createDirectiveRecord({
          clientId: conflict.client_id,
          projectId: directiveScope === 'project' ? conflict.project_id : null,
          hindsightDirectiveId: created.id,
          name: `Preference change (${scope})`,
          content: conflict.new_statement,
          scope: directiveScope,
          tags: created.tags,
          conflictId: conflict.id,
        });
        directive = { id: created.id, scope: directiveScope };
      }
    } catch (e) {
      // The memory is already stored, which is what drives recommendations. A
      // directive failure weakens enforcement but must not lose the preference.
      warnings.push('The preference was stored, but the hard rule could not be registered.');
      logger.warn('directive creation failed during conflict resolution', {
        conflictId: conflict.id,
        error: (e as Error).message,
      });
    }
  }

  // 3. Handle the superseded memory according to scope.
  let supersededMemory: ResolveConflictResult['supersededMemory'] = null;

  if (conflict.old_memory_ref_id || conflict.old_hindsight_memory_id) {
    if (isBroad && conflict.old_hindsight_memory_id) {
      // Client-wide change: remove the old preference from recall, keep it auditable.
      const result = await invalidateMemory(
        conflict.hindsight_bank_id,
        conflict.old_hindsight_memory_id,
        `Superseded by confirmed client-wide preference change on ${new Date().toISOString().slice(0, 10)}`,
      );
      if (!result.ok) {
        warnings.push('The previous preference could not be retired in the memory service.');
      }
      if (conflict.old_memory_ref_id) {
        await memoryRepo.setMemoryState(conflict.old_memory_ref_id, 'invalidated');
      }
      supersededMemory = {
        memoryRefId: conflict.old_memory_ref_id,
        statement: conflict.old_statement,
        state: result.ok ? 'invalidated' : 'valid',
      };
    } else if (conflict.old_memory_ref_id) {
      // Project-scoped or exception: the old preference remains valid elsewhere.
      await memoryRepo.setMemoryState(conflict.old_memory_ref_id, 'superseded');
      await memoryRepo.appendTag(conflict.old_memory_ref_id, SUPERSEDED_TAG);
      supersededMemory = {
        memoryRefId: conflict.old_memory_ref_id,
        statement: conflict.old_statement,
        state: 'superseded',
      };
    }

    // 4. Record the supersession edge for the timeline.
    if (conflict.old_memory_ref_id && retained.memoryRefId) {
      await memoryRepo.createMemoryLink({
        fromMemoryRefId: retained.memoryRefId,
        toMemoryRefId: conflict.old_memory_ref_id,
        relation: 'supersedes',
        scope: memoryScope,
        conflictId: conflict.id,
      });
    }
  }

  if (conflict.interaction_id) {
    await interactionsRepo.updateRetainStatus(conflict.interaction_id, 'retained', { error: null });
  }

  logger.info('conflict resolved', {
    conflictId: conflict.id,
    scope,
    directiveCreated: Boolean(directive),
    supersededState: supersededMemory?.state ?? null,
  });

  return {
    conflictId: conflict.id,
    status: claimed.status,
    resolvedScope: scope,
    newMemory: {
      memoryRefId: retained.memoryRefId,
      hindsightMemoryId: retained.hindsightMemoryId,
      statement: conflict.new_statement,
      scope: memoryScope,
    },
    supersededMemory,
    directive,
    warnings,
  };
}
