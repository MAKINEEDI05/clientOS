import type { Request, Response } from 'express';
import { z } from 'zod';
import * as clientsRepo from '../repositories/clients.repo.js';
import * as memoryRepo from '../repositories/memory.repo.js';
import * as conflictsRepo from '../repositories/conflicts.repo.js';
import { parseIdParam, parseQuery } from '../middleware/validate.js';
import { ok } from '../utils/respond.js';
import { AppError } from '../utils/errors.js';
import { MEMORY_STATES, MEMORY_TYPES } from '../types/domain.js';
import { presentMemory } from './memory.presenter.js';

export async function listClients(_req: Request, res: Response): Promise<void> {
  const clients = await clientsRepo.listClientSummaries();
  ok(res, {
    clients: clients.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      industry: c.industry,
      context: c.context,
      projectCount: c.project_count,
      interactionCount: c.interaction_count,
      openConflicts: c.open_conflicts,
      lastInteractionAt: c.last_interaction_at,
      counts: {
        preference: c.counts.preference ?? 0,
        approval: c.counts.approval ?? 0,
        rejection: c.counts.rejection ?? 0,
        constraint: c.counts.constraint ?? 0,
        decision: c.counts.decision ?? 0,
        outcome: c.counts.outcome ?? 0,
        preference_change: c.counts.preference_change ?? 0,
      },
    })),
  });
}

export async function getClient(req: Request, res: Response): Promise<void> {
  const idOrSlug = parseIdParam(req.params.clientId, 'Client');
  const client = await clientsRepo.findClient(idOrSlug);
  if (!client) throw AppError.notFound('Client');

  const projects = await clientsRepo.listProjectsForClient(client.id);

  ok(res, {
    client: {
      id: client.id,
      slug: client.slug,
      name: client.name,
      industry: client.industry,
      context: client.context,
      // The bank id is surfaced so the UI can show which memory bank is in use.
      hindsightBankId: client.hindsight_bank_id,
    },
    projects: projects.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      interactionCount: p.interaction_count,
      memoryCount: p.memory_count,
      openConflicts: p.open_conflicts,
    })),
  });
}

const memoryQuerySchema = z.object({
  type: z.enum(MEMORY_TYPES).optional(),
  state: z.enum(MEMORY_STATES).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function getClientMemory(req: Request, res: Response): Promise<void> {
  const idOrSlug = parseIdParam(req.params.clientId, 'Client');
  const client = await clientsRepo.findClient(idOrSlug);
  if (!client) throw AppError.notFound('Client');

  const filters = parseQuery(memoryQuerySchema, req);
  const [memories, links] = await Promise.all([
    memoryRepo.listClientMemories(client.id, filters),
    memoryRepo.listLinksForClient(client.id),
  ]);

  ok(res, {
    memories: memories.map((m) => presentMemory(m, links)),
    total: memories.length,
  });
}

export async function getClientConflicts(req: Request, res: Response): Promise<void> {
  const idOrSlug = parseIdParam(req.params.clientId, 'Client');
  const client = await clientsRepo.findClient(idOrSlug);
  if (!client) throw AppError.notFound('Client');

  const status = (req.query.status as string) ?? 'pending';
  const allowed = ['pending', 'resolved', 'dismissed', 'all'];
  if (!allowed.includes(status)) throw AppError.validation('Unknown conflict status filter.');

  const conflicts = await conflictsRepo.listConflicts(
    { clientId: client.id },
    status as 'pending' | 'resolved' | 'dismissed' | 'all',
  );
  ok(res, { conflicts: conflicts.map(presentConflict) });
}

export function presentConflict(c: {
  id: string;
  status: string;
  new_statement: string;
  new_memory_type: string;
  old_statement: string;
  old_hindsight_memory_id: string | null;
  old_memory_ref_id: string | null;
  explanation: string;
  interaction_label: string | null;
  resolved_scope: string | null;
  resolution: string | null;
  created_at: Date;
  resolved_at: Date | null;
}) {
  return {
    id: c.id,
    status: c.status,
    newStatement: c.new_statement,
    newMemoryType: c.new_memory_type,
    oldStatement: c.old_statement,
    oldMemoryId: c.old_hindsight_memory_id,
    oldMemoryRefId: c.old_memory_ref_id,
    explanation: c.explanation,
    interactionLabel: c.interaction_label,
    resolvedScope: c.resolved_scope,
    resolution: c.resolution,
    createdAt: c.created_at,
    resolvedAt: c.resolved_at,
  };
}
