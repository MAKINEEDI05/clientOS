import * as clientsRepo from '../repositories/clients.repo.js';
import * as projectsRepo from '../repositories/projects.repo.js';
import { deleteBank, ensureBank } from '../hindsight/banks.js';
import { bankIdForClient, slugify } from '../utils/slug.js';
import { AppError } from '../utils/errors.js';
import { isUniqueViolation, withTransaction } from '../db/pool.js';
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

export interface DeleteClientResult {
  clientId: string;
  deletedProjects: number;
}

/**
 * The two side effects of a deletion, injectable so tests can prove the
 * ordering and failure handling without touching a real memory bank.
 */
export interface DeleteClientDeps {
  deleteBank: (bankId: string) => Promise<void>;
  deleteClientRow: typeof clientsRepo.deleteClientById;
}

const DEFAULT_DELETE_DEPS: DeleteClientDeps = {
  deleteBank,
  deleteClientRow: clientsRepo.deleteClientById,
};

/**
 * Permanently delete ONE client: its Hindsight memory bank, then its database
 * row — whose projects, interactions, memory references, memory links,
 * conflicts, directives, recommendations and recommendation feedback go with
 * it through the schema's ON DELETE CASCADE foreign keys.
 *
 * Sequence, inside one PostgreSQL transaction:
 *   1. Lock the client row (a concurrent delete of the same client waits, then
 *      finds nothing and gets NOT_FOUND).
 *   2. Verify the bank is this client's own: `client-<slug>`, used by no other
 *      client. Anything else is refused before anything is deleted.
 *   3. Delete the Hindsight bank with the existing deleteBank(). If that fails,
 *      the transaction rolls back and the client is kept intact — retry is safe.
 *   4. DELETE FROM clients WHERE id = $1, expecting exactly one row; commit.
 *
 * Limitation, stated rather than hidden: PostgreSQL and Hindsight cannot share a
 * transaction. If step 4 (or the commit) fails after step 3 succeeded, the row
 * is rolled back but the bank is already gone. That case is reported as such —
 * never as success — and a retry completes it, because deleteBank() treats an
 * already-absent bank as done.
 */
export async function deleteClient(
  clientId: string,
  deps: DeleteClientDeps = DEFAULT_DELETE_DEPS,
): Promise<DeleteClientResult> {
  // Deletion is addressed by uuid only — never by slug or name.
  if (!clientsRepo.looksLikeUuid(clientId)) {
    throw AppError.validation('Client identifier must be a client id (uuid).');
  }

  let bankDeleted = false;
  let bankId: string | null = null;

  let result: DeleteClientResult & { slug: string };
  try {
    result = await withTransaction(async (tx) => {
      const client = await clientsRepo.lockClientForDeletion(tx, clientId);
      if (!client) throw AppError.notFound('Client');

      bankId = client.hindsight_bank_id;
      if (!bankId || bankId !== bankIdForClient(client.slug)) {
        throw AppError.conflict(
          "This client's memory bank does not match the client, so it was not deleted. Nothing was removed.",
        );
      }
      if ((await clientsRepo.countClientsUsingBank(tx, bankId)) !== 1) {
        throw AppError.conflict(
          "This client's memory bank is shared with another client, so it was not deleted. Nothing was removed.",
        );
      }

      // Hindsight first: a failure here rolls back and keeps the client intact.
      await deps.deleteBank(bankId);
      bankDeleted = true;

      const removed = await deps.deleteClientRow(tx, client.id);
      if (removed !== 1) {
        throw new Error(`expected to delete 1 client row, deleted ${removed}`);
      }

      return { clientId: client.id, deletedProjects: client.project_count, slug: client.slug };
    });
  } catch (e) {
    if (!bankDeleted) throw e;
    // The bank is gone but the database change was rolled back. Say exactly that.
    logger.error('client deletion incomplete: memory bank deleted, client record kept', {
      clientId,
      bankId,
      error: (e as Error).message,
    });
    throw AppError.internal(
      "The client's memory bank was deleted, but the client record could not be removed and was kept. " +
        'Delete the client again to finish.',
      { clientId, bankDeleted: true },
    );
  }

  // Logged only once the transaction has committed.
  logger.warn('client deleted', {
    clientId: result.clientId,
    slug: result.slug,
    bankId,
    deletedProjects: result.deletedProjects,
  });
  return { clientId: result.clientId, deletedProjects: result.deletedProjects };
}
