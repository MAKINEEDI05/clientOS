import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveConflict } from '../services/conflicts.service.js';
import * as conflictsRepo from '../repositories/conflicts.repo.js';
import { ensureDemoUser } from '../repositories/users.repo.js';
import { parseBody, parseIdParam } from '../middleware/validate.js';
import { ok } from '../utils/respond.js';
import { AppError } from '../utils/errors.js';
import { CONFLICT_SCOPES } from '../types/domain.js';
import { presentConflict } from './clients.controller.js';

const resolveSchema = z
  .object({
    resolution: z.enum(['new_preference', 'keep_existing', 'dismissed']),
    scope: z.enum(CONFLICT_SCOPES).optional(),
  })
  .refine((v) => v.resolution !== 'new_preference' || Boolean(v.scope), {
    message: 'A scope is required when confirming the new preference.',
    path: ['scope'],
  });

export async function getConflict(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req.params.conflictId, 'Conflict');
  const conflict = await conflictsRepo.findConflictWithContext(id);
  if (!conflict) throw AppError.notFound('Conflict');
  ok(res, {
    conflict: {
      ...presentConflict(conflict),
      projectName: conflict.project_name,
      clientName: conflict.client_name,
    },
  });
}

/**
 * Resolve a preference conflict at a confirmed scope.
 *
 * The scope choice determines whether the old preference is merely marked
 * superseded (project / exception) or invalidated in Hindsight (client-wide).
 * Nothing is deleted in any branch.
 */
export async function postResolveConflict(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req.params.conflictId, 'Conflict');
  const body = parseBody(resolveSchema, req);
  const user = await ensureDemoUser();

  const result = await resolveConflict({
    conflictId: id,
    resolution: body.resolution,
    scope: body.scope ?? null,
    userId: user.id,
  });

  ok(res, result);
}
