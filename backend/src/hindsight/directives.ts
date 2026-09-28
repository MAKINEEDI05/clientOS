import { getHindsight, toMemoryError } from './client.js';
import { clientTag, projectTag } from './tags.js';
import { logger } from '../utils/logger.js';

/**
 * Directives are hard rules, TAG-SCOPED by default: untagged directives always
 * apply, tagged ones only when the request's tags match.
 *
 * IMPORTANT: Hindsight applies directives during `reflect`, which ClientOS does
 * not call. So the directive recorded here is NOT enforced by Hindsight — it is
 * the durable, scoped record of a confirmed rule. What makes the confirmed change
 * actually bind is (1) the retained memory's own tags at recall time and (2) the
 * local directive record injected into the recommendation prompt
 * (services/agent.service.ts). Creating it here keeps the rule in the memory
 * layer where it belongs, and makes it enforceable by Hindsight the day reflect
 * is used — but do not describe it as active enforcement today.
 */

export interface CreateDirectiveInput {
  bankId: string;
  name: string;
  content: string;
  scope: 'project' | 'client';
  clientSlug: string;
  projectSlug?: string | null;
  priority?: number;
}

export interface CreatedDirective {
  id: string;
  tags: string[];
}

export async function createScopedDirective(input: CreateDirectiveInput): Promise<CreatedDirective> {
  const tags =
    input.scope === 'project' && input.projectSlug
      ? [projectTag(input.projectSlug)]
      : [clientTag(input.clientSlug)];

  try {
    const res = await getHindsight().createDirective(input.bankId, input.name, input.content, {
      tags,
      priority: input.priority ?? 10,
      isActive: true,
    });

    const id = (res as { id?: string }).id ?? '';
    logger.info('hindsight directive created', {
      bankId: input.bankId,
      directiveId: id,
      scope: input.scope,
      tags,
    });
    return { id, tags };
  } catch (e) {
    throw toMemoryError(e, 'createDirective');
  }
}


export async function deleteDirective(bankId: string, directiveId: string): Promise<void> {
  try {
    await getHindsight().deleteDirective(bankId, directiveId);
    logger.info('hindsight directive deleted', { bankId, directiveId });
  } catch (e) {
    throw toMemoryError(e, 'deleteDirective');
  }
}
