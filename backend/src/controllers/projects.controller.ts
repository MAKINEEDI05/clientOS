import type { Request, Response } from 'express';
import { z } from 'zod';
import * as projectsRepo from '../repositories/projects.repo.js';
import * as interactionsRepo from '../repositories/interactions.repo.js';
import * as memoryRepo from '../repositories/memory.repo.js';
import * as conflictsRepo from '../repositories/conflicts.repo.js';
import { ensureDemoUser } from '../repositories/users.repo.js';
import { submitInteraction } from '../services/interactions.service.js';
import { parseBody, parseIdParam, parseQuery } from '../middleware/validate.js';
import { ok } from '../utils/respond.js';
import { AppError } from '../utils/errors.js';
import {
  INTERACTION_SOURCES,
  MEMORY_SCOPES,
  MEMORY_STATES,
  MEMORY_TYPES,
} from '../types/domain.js';
import { presentMemory } from './memory.presenter.js';
import { presentConflict } from './clients.controller.js';

/** Resolve a project or 404. Used by every project-scoped route. */
async function requireProject(req: Request): Promise<projectsRepo.ProjectWithClient> {
  const idOrSlug = parseIdParam(req.params.projectId, 'Project');
  const project = await projectsRepo.findProjectWithClient(idOrSlug);
  if (!project) throw AppError.notFound('Project');
  // An archived project must not receive new memory (edge case 3.12).
  return project;
}

export async function getProject(req: Request, res: Response): Promise<void> {
  const project = await requireProject(req);

  const [memories, links, openConflicts] = await Promise.all([
    memoryRepo.listProjectMemories(project.client_id, project.id, { state: 'valid' }),
    memoryRepo.listLinksForClient(project.client_id),
    conflictsRepo.countPending(project.id),
  ]);

  const grouped: Record<string, ReturnType<typeof presentMemory>[]> = {
    preference: [],
    approval: [],
    rejection: [],
    constraint: [],
    decision: [],
    outcome: [],
    preference_change: [],
  };
  for (const m of memories) {
    const presented = presentMemory(m, links);
    (grouped[m.memory_type] ??= []).push(presented);
  }

  ok(res, {
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      status: project.status,
    },
    client: {
      id: project.client_id,
      slug: project.client_slug,
      name: project.client_name,
      context: project.client_context,
      hindsightBankId: project.hindsight_bank_id,
    },
    memory: {
      preferences: grouped.preference ?? [],
      approvals: grouped.approval ?? [],
      rejections: grouped.rejection ?? [],
      constraints: grouped.constraint ?? [],
      decisions: grouped.decision ?? [],
      outcomes: grouped.outcome ?? [],
      changes: grouped.preference_change ?? [],
    },
    memoryCount: memories.length,
    openConflicts,
  });
}

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function listProjectInteractions(req: Request, res: Response): Promise<void> {
  const project = await requireProject(req);
  const { limit, offset } = parseQuery(listQuerySchema, req);

  const [interactions, total] = await Promise.all([
    interactionsRepo.listInteractions(project.id, { limit, offset }),
    interactionsRepo.countInteractions(project.id),
  ]);

  ok(res, {
    interactions: interactions.map((i) => ({
      id: i.id,
      label: i.label,
      source: i.source,
      content: i.content,
      occurredAt: i.occurred_at,
      retainStatus: i.retain_status,
      retainError: i.retain_error,
      memoryCount: i.memory_count,
      createdAt: i.created_at,
    })),
    total,
  });
}

const createInteractionSchema = z.object({
  label: z.string().trim().min(1, 'A label is required').max(80),
  source: z.enum(INTERACTION_SOURCES),
  // Bounded to keep token growth controlled (edge case 6.6).
  content: z.string().trim().min(1, 'Feedback text is required').max(5000),
  occurredAt: z.coerce.date().optional(),
});

export async function createProjectInteraction(req: Request, res: Response): Promise<void> {
  const project = await requireProject(req);

  if (project.status === 'archived') {
    throw AppError.conflict('This project is archived and cannot accept new interactions.');
  }

  const body = parseBody(createInteractionSchema, req);
  const user = await ensureDemoUser();

  const result = await submitInteraction({
    project,
    label: body.label,
    source: body.source,
    content: body.content,
    occurredAt: body.occurredAt ?? new Date(),
    userId: user.id,
  });

  ok(
    res,
    {
      interaction: {
        id: result.interaction.id,
        label: result.interaction.label,
        source: result.interaction.source,
        content: result.interaction.content,
        occurredAt: result.interaction.occurred_at,
        retainStatus: result.retainStatus,
      },
      extracted: result.extracted,
      discarded: result.discarded,
      retained: result.retainedCount,
      conflicts: result.conflicts,
      warnings: result.warnings,
    },
    201,
  );
}

const memoryQuerySchema = z.object({
  type: z.enum(MEMORY_TYPES).optional(),
  scope: z.enum(MEMORY_SCOPES).optional(),
  state: z.enum(MEMORY_STATES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function getProjectMemory(req: Request, res: Response): Promise<void> {
  const project = await requireProject(req);
  const filters = parseQuery(memoryQuerySchema, req);

  const [memories, links] = await Promise.all([
    memoryRepo.listProjectMemories(project.client_id, project.id, filters),
    memoryRepo.listLinksForClient(project.client_id),
  ]);

  ok(res, {
    memories: memories.map((m) => presentMemory(m, links)),
    total: memories.length,
    bankId: project.hindsight_bank_id,
  });
}

export async function getProjectConflicts(req: Request, res: Response): Promise<void> {
  const project = await requireProject(req);
  const status = (req.query.status as string) ?? 'pending';
  const allowed = ['pending', 'resolved', 'dismissed', 'all'];
  if (!allowed.includes(status)) throw AppError.validation('Unknown conflict status filter.');

  const conflicts = await conflictsRepo.listConflicts(
    { projectId: project.id },
    status as 'pending' | 'resolved' | 'dismissed' | 'all',
  );
  ok(res, { conflicts: conflicts.map(presentConflict) });
}
