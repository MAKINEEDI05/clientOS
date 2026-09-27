import { query, queryOne } from '../db/pool.js';
import type { ProjectRow } from '../types/domain.js';
import { looksLikeUuid } from './clients.repo.js';

export interface ProjectWithClient extends ProjectRow {
  client_slug: string;
  client_name: string;
  hindsight_bank_id: string;
  client_context: string | null;
}

/**
 * Resolve a project together with its client, in one query.
 *
 * Every downstream operation needs both the project slug (for tags) and the
 * client's bank id, and fetching them together removes any chance of pairing a
 * project with the wrong client's bank.
 */
export async function findProjectWithClient(idOrSlug: string): Promise<ProjectWithClient | null> {
  const where = looksLikeUuid(idOrSlug) ? 'p.id = $1' : 'p.slug = $1';
  return queryOne<ProjectWithClient>(
    `SELECT p.*,
            c.slug              AS client_slug,
            c.name              AS client_name,
            c.hindsight_bank_id AS hindsight_bank_id,
            c.context           AS client_context
     FROM projects p
     JOIN clients c ON c.id = p.client_id
     WHERE ${where}
     LIMIT 1`,
    [idOrSlug],
  );
}

/**
 * Resolve a project and assert it belongs to the given client.
 *
 * This is the isolation boundary for project routes: a project id from another
 * client resolves to null rather than leaking (edge cases 3.2, 3.13, 8.3).
 */
export async function findProjectForClient(
  clientId: string,
  projectIdOrSlug: string,
): Promise<ProjectWithClient | null> {
  const project = await findProjectWithClient(projectIdOrSlug);
  if (!project) return null;
  if (project.client_id !== clientId) return null;
  return project;
}

export async function createProject(input: {
  clientId: string;
  slug: string;
  name: string;
}): Promise<ProjectRow> {
  const row = await queryOne<ProjectRow>(
    `INSERT INTO projects (client_id, slug, name) VALUES ($1, $2, $3) RETURNING *`,
    [input.clientId, input.slug, input.name],
  );
  if (!row) throw new Error('project insert returned no row');
  return row;
}

export async function listAllProjects(): Promise<ProjectWithClient[]> {
  return query<ProjectWithClient>(
    `SELECT p.*, c.slug AS client_slug, c.name AS client_name,
            c.hindsight_bank_id AS hindsight_bank_id, c.context AS client_context
     FROM projects p JOIN clients c ON c.id = p.client_id
     ORDER BY p.created_at ASC`,
  );
}
