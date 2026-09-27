import * as clientsRepo from '../repositories/clients.repo.js';
import * as projectsRepo from '../repositories/projects.repo.js';
import { ensureBank } from '../hindsight/banks.js';
import { bankIdForClient, slugify } from '../utils/slug.js';
import { AppError } from '../utils/errors.js';
import { isUniqueViolation } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import type { ClientRow } from '../types/domain.js';

export interface CreateClientInput {
  name: string;
  description?: string | null;
  /** Optional first project, created in the same flow. */
  firstProjectName?: string | null;
}

export interface CreateClientResult {
  client: ClientRow;
  projectId: string | null;
  projectSlug: string | null;
}

/**
 * Create a client and its memory bank.
 *
 * Ordering is deliberate: the Hindsight bank is created BEFORE the database row.
 * A client row only ever exists once its memory bank exists, so there is no way
 * to end up with a client that looks usable but has nowhere to store memory.
 *
 * If the bank succeeds and the database insert then fails, the bank is left in
 * place. That is harmless — it is empty, `createBank` is create-or-update, and a
 * retry with the same name reuses it rather than duplicating.
 */
export async function createClientWithBank(
  input: CreateClientInput,
): Promise<CreateClientResult> {
  const name = input.name.trim();
  const slug = slugify(name);

  if (!slug) {
    throw AppError.validation('Client name must contain at least one letter or number.');
  }

  if (await clientsRepo.clientSlugExists(slug)) {
    throw AppError.conflict(`A client named "${name}" already exists.`);
  }

  const bankId = bankIdForClient(slug);
  const description = input.description?.trim() || null;

  // 1. Memory bank first. A failure here aborts with nothing created.
  await ensureBank({ bankId, clientName: name, clientContext: description });

  // 2. Application record.
  let client: ClientRow;
  try {
    client = await clientsRepo.createClient({
      slug,
      name,
      hindsightBankId: bankId,
      context: description,
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Lost a race against a concurrent create.
      throw AppError.conflict(`A client named "${name}" already exists.`);
    }
    logger.error('client record insert failed after bank creation', {
      bankId,
      error: (e as Error).message,
    });
    throw e;
  }

  // 3. Optional first project, so a new client is immediately usable.
  let projectId: string | null = null;
  let projectSlug: string | null = null;
  const firstProject = input.firstProjectName?.trim();
  if (firstProject) {
    const pSlug = slugify(firstProject) || 'project';
    const project = await projectsRepo.createProject({
      clientId: client.id,
      slug: pSlug,
      name: firstProject,
    });
    projectId = project.id;
    projectSlug = project.slug;
  }

  logger.info('client created', { clientId: client.id, slug, bankId, withProject: Boolean(projectId) });
  return { client, projectId, projectSlug };
}
