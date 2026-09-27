import { query, queryOne } from '../db/pool.js';
import * as clientsRepo from '../repositories/clients.repo.js';
import * as projectsRepo from '../repositories/projects.repo.js';
import * as interactionsRepo from '../repositories/interactions.repo.js';
import { ensureDemoUser } from '../repositories/users.repo.js';
import { retainAndRecord } from './memory.service.js';
import { ensureBank, deleteBank } from '../hindsight/banks.js';
import { bankIdForClient, slugify } from '../utils/slug.js';
import {
  DEMO_CLIENT,
  DEMO_PROJECT,
  DEMO_INTERACTIONS,
  DEMO_CONFLICT_INTERACTION,
  ISOLATION_CLIENT,
  ISOLATION_PROJECT,
  ISOLATION_INTERACTIONS,
  daysAgoToDate,
  type DemoInteraction,
} from '../data/demoData.js';
import type { DemoStage } from '../types/domain.js';
import { logger } from '../utils/logger.js';

/**
 * Demo seeding and staging.
 *
 * Being able to return to a known state in one call is what makes the three-state
 * demo rehearsable rather than dependent on manual setup. It also covers edge
 * cases 10.1 and 10.11 (run the demo twice without duplicate-memory pollution).
 *
 * Seeding writes memories through retainAndRecord — the SAME path the live
 * application uses — so seeded memory is real Hindsight memory, not a fixture.
 */

const APP_TABLES = [
  'recommendation_feedback',
  'recommendations',
  'memory_links',
  'preference_conflicts',
  'hindsight_directives',
  'memory_refs',
  'interactions',
  'projects',
  'clients',
];

export async function getStage(): Promise<DemoStage> {
  const row = await queryOne<{ stage: DemoStage }>('SELECT stage FROM demo_state WHERE id = true');
  return row?.stage ?? 'empty';
}

async function setStage(stage: DemoStage): Promise<void> {
  await query(
    `INSERT INTO demo_state (id, stage, updated_at) VALUES (true, $1, now())
     ON CONFLICT (id) DO UPDATE SET stage = EXCLUDED.stage, updated_at = now()`,
    [stage],
  );
}

/** Truncate application tables. Hindsight banks are handled separately. */
async function truncateAppData(): Promise<void> {
  await query(`TRUNCATE ${APP_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

export interface ResetResult {
  stage: DemoStage;
  clientId: string;
  projectId: string;
  clientSlug: string;
  projectSlug: string;
  interactionsSeeded: number;
  memoriesRetained: number;
  bankId: string;
  isolationClientId: string | null;
  warnings: string[];
}

/**
 * Full reset: clear application data, delete and recreate the Hindsight banks,
 * then reseed to the requested stage.
 *
 * Deleting the bank is what guarantees a repeatable demo — without it, reseeding
 * would accumulate duplicate memories across runs.
 */
export async function resetDemo(stage: DemoStage): Promise<ResetResult> {
  const warnings: string[] = [];
  const bankId = bankIdForClient(DEMO_CLIENT.slug);
  const isolationBankId = bankIdForClient(ISOLATION_CLIENT.slug);

  logger.warn('demo reset starting', { stage, bankId });

  await truncateAppData();

  // Wipe memory so a rerun cannot inherit the previous run's state.
  await deleteBank(bankId);
  await deleteBank(isolationBankId);

  await ensureBank({
    bankId,
    clientName: DEMO_CLIENT.name,
    clientContext: DEMO_CLIENT.context,
  });
  await ensureBank({
    bankId: isolationBankId,
    clientName: ISOLATION_CLIENT.name,
    clientContext: ISOLATION_CLIENT.context,
  });

  const user = await ensureDemoUser();

  const client = await clientsRepo.createClient({
    slug: DEMO_CLIENT.slug,
    name: DEMO_CLIENT.name,
    hindsightBankId: bankId,
    industry: DEMO_CLIENT.industry,
    context: DEMO_CLIENT.context,
  });
  const project = await projectsRepo.createProject({
    clientId: client.id,
    slug: DEMO_PROJECT.slug,
    name: DEMO_PROJECT.name,
  });

  // Second client, so cross-client isolation can be demonstrated rather than asserted.
  const isolationClient = await clientsRepo.createClient({
    slug: ISOLATION_CLIENT.slug,
    name: ISOLATION_CLIENT.name,
    hindsightBankId: isolationBankId,
    industry: ISOLATION_CLIENT.industry,
    context: ISOLATION_CLIENT.context,
  });
  const isolationProject = await projectsRepo.createProject({
    clientId: isolationClient.id,
    slug: ISOLATION_PROJECT.slug,
    name: ISOLATION_PROJECT.name,
  });

  let interactionsSeeded = 0;
  let memoriesRetained = 0;

  if (stage !== 'empty') {
    const seeded = await seedInteractions({
      clientId: client.id,
      clientSlug: client.slug,
      projectId: project.id,
      projectSlug: project.slug,
      bankId,
      userId: user.id,
      interactions: DEMO_INTERACTIONS,
    });
    interactionsSeeded += seeded.interactions;
    memoriesRetained += seeded.memories;
    warnings.push(...seeded.warnings);

    const isoSeeded = await seedInteractions({
      clientId: isolationClient.id,
      clientSlug: isolationClient.slug,
      projectId: isolationProject.id,
      projectSlug: isolationProject.slug,
      bankId: isolationBankId,
      userId: user.id,
      interactions: ISOLATION_INTERACTIONS,
    });
    interactionsSeeded += isoSeeded.interactions;
    memoriesRetained += isoSeeded.memories;
    warnings.push(...isoSeeded.warnings);
  }

  if (stage === 'post_conflict') {
    // Seed the already-resolved project-scoped preference change, so the post-conflict
    // state can be reached without replaying the live conflict flow.
    const seeded = await seedResolvedConflict({
      clientId: client.id,
      clientSlug: client.slug,
      projectId: project.id,
      projectSlug: project.slug,
      bankId,
      userId: user.id,
    });
    interactionsSeeded += seeded.interactions;
    memoriesRetained += seeded.memories;
    warnings.push(...seeded.warnings);
  }

  await setStage(stage);

  logger.info('demo reset complete', { stage, interactionsSeeded, memoriesRetained });

  return {
    stage,
    clientId: client.id,
    projectId: project.id,
    clientSlug: client.slug,
    projectSlug: project.slug,
    interactionsSeeded,
    memoriesRetained,
    bankId,
    isolationClientId: isolationClient.id,
    warnings,
  };
}

interface SeedInteractionsInput {
  clientId: string;
  clientSlug: string;
  projectId: string;
  projectSlug: string;
  bankId: string;
  userId: string;
  interactions: DemoInteraction[];
}

/**
 * Seed interactions and their memories.
 *
 * Uses the declared `expectedMemories` rather than the extraction agent, so
 * seeding is deterministic and does not consume LLM calls or depend on Groq being
 * configured. The memories still go into Hindsight through the normal retain path.
 */
async function seedInteractions(
  input: SeedInteractionsInput,
): Promise<{ interactions: number; memories: number; warnings: string[] }> {
  const warnings: string[] = [];
  let interactions = 0;
  let memories = 0;

  for (const spec of input.interactions) {
    const occurredAt = daysAgoToDate(spec.daysAgo);
    const labelSlug = slugify(spec.label);

    const interaction = await interactionsRepo.createInteraction({
      clientId: input.clientId,
      projectId: input.projectId,
      label: spec.label,
      labelSlug,
      source: spec.source,
      content: spec.content,
      occurredAt,
      createdBy: input.userId,
    });
    interactions += 1;

    const documentId = `interaction:${interaction.id}`;

    for (const mem of spec.expectedMemories) {
      const res = await retainAndRecord({
        bankId: input.bankId,
        clientId: input.clientId,
        clientSlug: input.clientSlug,
        projectId: input.projectId,
        projectSlug: input.projectSlug,
        interactionId: interaction.id,
        memoryType: mem.type,
        statement: mem.statement,
        scope: mem.scope,
        contextLabel: `${spec.label} — ${spec.source}`,
        sourceLabelSlug: labelSlug,
        occurredAt,
        documentId,
        confidence: 0.95,
        sourceQuote: spec.content,
        metadata: {
          interactionId: interaction.id,
          interactionLabel: spec.label,
          seeded: 'true',
        },
      });
      if (res.metadataWriteFailed) {
        warnings.push(`Memory for ${spec.label} stored in Hindsight but local record failed.`);
      }
      memories += 1;
    }

    await interactionsRepo.updateRetainStatus(interaction.id, 'retained', {
      hindsightDocumentId: documentId,
    });
  }

  return { interactions, memories, warnings };
}

/** Seed Revision #6 as an already-resolved, project-scoped preference change. */
async function seedResolvedConflict(input: {
  clientId: string;
  clientSlug: string;
  projectId: string;
  projectSlug: string;
  bankId: string;
  userId: string;
}): Promise<{ interactions: number; memories: number; warnings: string[] }> {
  const spec = DEMO_CONFLICT_INTERACTION;
  const occurredAt = daysAgoToDate(spec.daysAgo);
  const labelSlug = slugify(spec.label);
  const warnings: string[] = [];

  const interaction = await interactionsRepo.createInteraction({
    clientId: input.clientId,
    projectId: input.projectId,
    label: spec.label,
    labelSlug,
    source: spec.source,
    content: spec.content,
    occurredAt,
    createdBy: input.userId,
  });

  const documentId = `interaction:${interaction.id}`;
  let memories = 0;

  for (const mem of spec.expectedMemories) {
    const res = await retainAndRecord({
      bankId: input.bankId,
      clientId: input.clientId,
      clientSlug: input.clientSlug,
      projectId: input.projectId,
      projectSlug: input.projectSlug,
      interactionId: interaction.id,
      memoryType: mem.type,
      statement: mem.statement,
      scope: mem.scope,
      contextLabel: `${spec.label} — confirmed preference change`,
      sourceLabelSlug: labelSlug,
      occurredAt,
      documentId,
      confidence: 0.95,
      sourceQuote: spec.content,
      metadata: { interactionId: interaction.id, confirmedScope: 'project', seeded: 'true' },
    });
    if (res.metadataWriteFailed) warnings.push('Preference change stored but local record failed.');
    memories += 1;
  }

  await interactionsRepo.updateRetainStatus(interaction.id, 'retained', {
    hindsightDocumentId: documentId,
  });

  return { interactions: 1, memories, warnings };
}

/** Switch stage without recreating banks. */
export async function stageDemo(stage: DemoStage): Promise<ResetResult> {
  return resetDemo(stage);
}
