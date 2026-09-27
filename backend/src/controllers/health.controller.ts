import type { Request, Response } from 'express';
import { checkDatabase } from '../db/pool.js';
import { probeHindsight } from '../hindsight/client.js';
import { env } from '../config/env.js';
import { getStage } from '../services/demo.service.js';
import { ok } from '../utils/respond.js';
import { AppError } from '../utils/errors.js';

const startedAt = Date.now();

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const db = await checkDatabase();
  if (!db) throw AppError.databaseUnavailable('database is not reachable');
  ok(res, { status: 'ok', db, uptimeMs: Date.now() - startedAt });
}

/**
 * Memory-layer health. Always returns 200 with a verdict so the UI badge can
 * always render — a red badge is more useful than a failed request.
 */
export async function getHindsightHealth(_req: Request, res: Response): Promise<void> {
  const probe = await probeHindsight();
  const stage = await getStage().catch(() => 'empty' as const);

  ok(res, {
    ...probe,
    configured: env.hindsightConfigured,
    baseUrl: env.HINDSIGHT_BASE_URL,
    tenant: env.HINDSIGHT_TENANT_ID,
    llmConfigured: env.groqConfigured,
    model: env.GROQ_MODEL,
    demoStage: stage,
  });
}
