import { getHindsight, toMemoryError } from './client.js';
import { clientTag, projectTag } from './tags.js';
import { logger } from '../utils/logger.js';

/**
 * Directives are hard rules Hindsight applies during `reflect`, and they are
 * TAG-SCOPED by default: untagged directives always apply, tagged ones only when
 * the request's tags match.
 *
 * That property is what makes a project-scoped preference change bind only where
 * the user confirmed it, without invalidating the client's broader preference.
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

export async function listDirectives(bankId: string): Promise<unknown> {
  try {
    return await getHindsight().listDirectives(bankId);
  } catch (e) {
    throw toMemoryError(e, 'listDirectives');
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
