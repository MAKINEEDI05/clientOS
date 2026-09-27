import { query, queryOne } from '../db/pool.js';

export interface DirectiveRow {
  id: string;
  client_id: string;
  project_id: string | null;
  hindsight_directive_id: string;
  name: string;
  content: string;
  scope: 'project' | 'client';
  tags: string[];
  conflict_id: string | null;
  is_active: boolean;
  created_at: Date;
}

export async function createDirectiveRecord(input: {
  clientId: string;
  projectId: string | null;
  hindsightDirectiveId: string;
  name: string;
  content: string;
  scope: 'project' | 'client';
  tags: string[];
  conflictId?: string | null;
}): Promise<DirectiveRow> {
  const row = await queryOne<DirectiveRow>(
    `INSERT INTO hindsight_directives
       (client_id, project_id, hindsight_directive_id, name, content, scope, tags, conflict_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     RETURNING *`,
    [
      input.clientId,
      input.projectId,
      input.hindsightDirectiveId,
      input.name,
      input.content,
      input.scope,
      JSON.stringify(input.tags),
      input.conflictId ?? null,
    ],
  );
  if (!row) throw new Error('directive insert returned no row');
  return row;
}

/**
 * Directives that apply in a given project context: project-scoped ones for this
 * project, plus client-wide ones.
 */
export async function listApplicableDirectives(
  clientId: string,
  projectId: string,
): Promise<DirectiveRow[]> {
  return query<DirectiveRow>(
    `SELECT * FROM hindsight_directives
     WHERE client_id = $1 AND is_active
       AND (project_id = $2 OR project_id IS NULL)
     ORDER BY created_at ASC`,
    [clientId, projectId],
  );
}

export async function listDirectivesForClient(clientId: string): Promise<DirectiveRow[]> {
  return query<DirectiveRow>(
    `SELECT * FROM hindsight_directives WHERE client_id = $1 ORDER BY created_at ASC`,
    [clientId],
  );
}
