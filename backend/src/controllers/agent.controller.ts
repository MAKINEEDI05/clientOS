import type { Request, Response } from 'express';
import { z } from 'zod';
import * as projectsRepo from '../repositories/projects.repo.js';
import * as clientsRepo from '../repositories/clients.repo.js';
import * as recommendationsRepo from '../repositories/recommendations.repo.js';
import { ensureDemoUser } from '../repositories/users.repo.js';
import {
  presentStoredRecommendation,
  recordFeedback,
  requestRecommendation,
} from '../services/agent.service.js';
import { parseBody, parseIdParam } from '../middleware/validate.js';
import { ok } from '../utils/respond.js';
import { AppError } from '../utils/errors.js';

const recommendSchema = z.object({
  clientId: z.string().trim().min(1).max(120),
  projectId: z.string().trim().min(1).max(120),
  // Bounded to prevent uncontrolled context growth (edge case 6.6).
  message: z.string().trim().min(1, 'A request is required').max(1000),
  useMemory: z.boolean().optional(),
});

/**
 * The core read path.
 *
 * Client and project are BOTH resolved and their relationship asserted, so a
 * project id belonging to another client cannot be used to reach that client's
 * memory (edge cases 3.13, 8.3).
 */
export async function postRecommend(req: Request, res: Response): Promise<void> {
  const body = parseBody(recommendSchema, req);

  const client = await clientsRepo.findClient(body.clientId);
  if (!client) throw AppError.notFound('Client');

  const project = await projectsRepo.findProjectForClient(client.id, body.projectId);
  if (!project) throw AppError.notFound('Project');

  const result = await requestRecommendation({
    project,
    message: body.message,
    useMemory: body.useMemory ?? true,
  });

  ok(res, result);
}

export async function getRecommendation(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req.params.recommendationId, 'Recommendation');
  const row = await recommendationsRepo.findRecommendation(id);
  if (!row) throw AppError.notFound('Recommendation');
  ok(res, presentStoredRecommendation(row));
}

const feedbackSchema = z
  .object({
    verdict: z.enum(['accepted', 'rejected', 'corrected']),
    comment: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.verdict !== 'corrected' || (v.comment && v.comment.length > 0), {
    message: 'A comment is required when correcting a recommendation.',
    path: ['comment'],
  });

export async function postFeedback(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req.params.recommendationId, 'Recommendation');
  const body = parseBody(feedbackSchema, req);

  const row = await recommendationsRepo.findRecommendation(id);
  if (!row) throw AppError.notFound('Recommendation');

  const project = await projectsRepo.findProjectWithClient(row.project_id);
  if (!project) throw AppError.notFound('Project');

  const user = await ensureDemoUser();
  const result = await recordFeedback({
    recommendationId: id,
    verdict: body.verdict,
    comment: body.comment ?? null,
    userId: user.id,
    project,
  });

  ok(res, result);
}
