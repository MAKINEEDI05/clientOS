import type { Request, Response } from 'express';
import { z } from 'zod';
import { invalidateMemoryRef, restoreMemoryRef } from '../services/memory.service.js';
import { parseBody, parseIdParam } from '../middleware/validate.js';
import { ok } from '../utils/respond.js';

const invalidateSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

/**
 * Retire a memory from active reasoning.
 *
 * This does NOT delete anything: the memory remains on the timeline as history
 * and can be restored. Hindsight's invalidation keeps it auditable.
 */
export async function postInvalidateMemory(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req.params.memoryId, 'Memory');
  const body = parseBody(invalidateSchema, req);
  const result = await invalidateMemoryRef(
    id,
    body.reason?.trim() || 'Retired by the team from the memory timeline',
  );
  ok(res, result);
}

export async function postRestoreMemory(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req.params.memoryId, 'Memory');
  const result = await restoreMemoryRef(id);
  ok(res, result);
}
