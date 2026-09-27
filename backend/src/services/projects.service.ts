import * as projectsRepo from '../repositories/projects.repo.js';
import { slugify } from '../utils/slug.js';
import { AppError } from '../utils/errors.js';
import { isUniqueViolation } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import type { ProjectRow } from '../types/domain.js';

export interface CreateProjectInput {
  clientId: string;
  name: string;
  description?: string | null;
}

/**
 * Create a project for a client.
 *
 * No Hindsight work is needed: a project is a tag inside the client's existing
 * bank, not a bank of its own (see docs/PRODUCT_DECISIONS.md Decision 9). That is
 * why this path cannot fail on the memory layer.
 */
export async function createProjectForClient(input: CreateProjectInput): Promise<ProjectRow> {
  const name = input.name.trim();
  const slug = slugify(name);

  if (!slug) {
    throw AppError.validation('Project name must contain at least one letter or number.');
  }

  if (await projectsRepo.projectSlugExists(input.clientId, slug)) {
    throw AppError.conflict(`This client already has a project named "${name}".`);
  }

  try {
    const project = await projectsRepo.createProject({
      clientId: input.clientId,
      slug,
      name,
      description: input.description?.trim() || null,
    });
    logger.info('project created', { projectId: project.id, clientId: input.clientId, slug });
    return project;
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw AppError.conflict(`This client already has a project named "${name}".`);
    }
    throw e;
  }
}
