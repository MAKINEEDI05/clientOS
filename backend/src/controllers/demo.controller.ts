import type { Request, Response } from 'express';
import { z } from 'zod';
import { resetDemo, getStage } from '../services/demo.service.js';
import { parseBody } from '../middleware/validate.js';
import { ok } from '../utils/respond.js';
import { DEMO_STAGES } from '../types/domain.js';
import { DEMO_REQUEST } from '../data/demoData.js';

const stageSchema = z.object({ stage: z.enum(DEMO_STAGES) });

export async function getDemoState(_req: Request, res: Response): Promise<void> {
  ok(res, { stage: await getStage(), demoRequest: DEMO_REQUEST });
}

/**
 * Destructive: truncates application data and deletes the Hindsight banks before
 * reseeding. Token-guarded. This is what makes the demo repeatable without
 * duplicate-memory pollution across runs.
 */
export async function postResetDemo(req: Request, res: Response): Promise<void> {
  const { stage } = parseBody(stageSchema, req);
  const result = await resetDemo(stage);
  ok(res, result);
}

export async function postStageDemo(req: Request, res: Response): Promise<void> {
  const { stage } = parseBody(stageSchema, req);
  const result = await resetDemo(stage);
  ok(res, result);
}
