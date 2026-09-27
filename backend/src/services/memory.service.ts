import { createHash } from 'node:crypto';
import { retainForBank, type RetainMemoryInput } from '../hindsight/retain.js';
import { listMemoriesByDocument } from '../hindsight/recall.js';
import * as memoryRepo from '../repositories/memory.repo.js';
import type { MemoryScope, MemoryType } from '../types/domain.js';
import { logger } from '../utils/logger.js';

/**
 * Retain a memory in Hindsight and record a pointer row in PostgreSQL.
 *
 * Ordering matters: Hindsight FIRST. If the memory write fails we must not have a
 * database row implying it succeeded (edge case 3.7). If Hindsight succeeds but
 * the database row fails, we report partial failure rather than silent success
 * (edge case 3.6).
 */
export interface RetainAndRecordInput {
  bankId: string;
  clientId: string;
  clientSlug: string;
  projectId: string | null;
  projectSlug: string | null;
  interactionId: string | null;
  memoryType: MemoryType;
  statement: string;
  scope: MemoryScope;
  contextLabel?: string | null;
  sourceLabelSlug?: string | null;
  occurredAt?: Date | null;
  documentId?: string | null;
  confidence?: number | null;
  sourceQuote?: string | null;
  extraTags?: string[];
  metadata?: Record<string, string>;
}

export interface RetainAndRecordResult {
  memoryRefId: string;
  hindsightMemoryId: string | null;
  tags: string[];
  /** True when Hindsight stored it but the local pointer row could not be written. */
  metadataWriteFailed: boolean;
}

/**
 * Hindsight's retain defaults to update_mode 'replace', so two memories sharing a
 * document_id overwrite each other. Each memory therefore gets its own document,
 * suffixed with a hash of its statement.
 *
 * The hash is deterministic on purpose: re-retaining the SAME statement for the
 * same interaction replaces that one document instead of creating a duplicate,
 * which makes repeated submissions idempotent rather than evidence-inflating.
 */
export function documentIdFor(base: string, statement: string): string {
  const digest = createHash('sha256')
    .update(statement.toLowerCase().replace(/\s+/g, ' ').trim())
    .digest('hex')
    .slice(0, 10);
  return `${base}#${digest}`;
}

export async function retainAndRecord(
  input: RetainAndRecordInput,
): Promise<RetainAndRecordResult> {
  const documentId = input.documentId
    ? documentIdFor(input.documentId, input.statement)
    : null;

  const retainInput: RetainMemoryInput = {
    statement: input.statement,
    memoryType: input.memoryType,
    scope: input.scope,
    clientSlug: input.clientSlug,
    projectSlug: input.projectSlug,
    contextLabel: input.contextLabel ?? null,
    sourceLabelSlug: input.sourceLabelSlug ?? null,
    occurredAt: input.occurredAt ?? null,
    documentId,
    extraTags: input.extraTags,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  // 1. Hindsight is the memory system — it goes first and its failure aborts.
  const retained = await retainForBank(input.bankId, retainInput);

  // 2. Local pointer row. A failure here is reported, never hidden.
  let memoryRefId: string;
  try {
    const ref = await memoryRepo.createMemoryRef({
      clientId: input.clientId,
      projectId: input.projectId,
      interactionId: input.interactionId,
      memoryType: input.memoryType,
      statement: input.statement,
      scope: input.scope,
      tags: retained.tags,
      hindsightDocumentId: documentId,
      confidence: input.confidence ?? null,
      sourceQuote: input.sourceQuote ?? null,
    });
    memoryRefId = ref.id;
  } catch (e) {
    logger.error('hindsight retain succeeded but metadata write failed', {
      bankId: input.bankId,
      error: (e as Error).message,
    });
    return { memoryRefId: '', hindsightMemoryId: null, tags: retained.tags, metadataWriteFailed: true };
  }

  // 3. Reconcile the Hindsight memory id (retain does not return one).
  let hindsightMemoryId: string | null = null;
  if (documentId) {
    try {
      hindsightMemoryId = await reconcileMemoryId(
        input.bankId,
        documentId,
        input.statement,
        memoryRefId,
      );
    } catch (e) {
      // Non-fatal: the memory exists in Hindsight, we just could not resolve its id yet.
      logger.warn('memory id reconciliation failed', { error: (e as Error).message });
    }
  }

  return { memoryRefId, hindsightMemoryId, tags: retained.tags, metadataWriteFailed: false };
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Token overlap, used to pair our statement with the fact Hindsight extracted. */
function similarity(a: string, b: string): number {
  const at = new Set(normalise(a).split(' ').filter((w) => w.length > 3));
  const bt = new Set(normalise(b).split(' ').filter((w) => w.length > 3));
  if (at.size === 0 || bt.size === 0) return 0;
  let shared = 0;
  for (const t of at) if (bt.has(t)) shared += 1;
  return shared / Math.min(at.size, bt.size);
}

/**
 * Resolve the Hindsight memory id for a statement we just retained.
 *
 * Hindsight extracts facts rather than storing text verbatim, so the returned
 * fact may be worded differently and there may be more or fewer facts than we
 * submitted. We match on best token overlap and only accept a confident match.
 */
export async function reconcileMemoryId(
  bankId: string,
  documentId: string,
  statement: string,
  memoryRefId: string,
): Promise<string | null> {
  const units = await listMemoriesByDocument(bankId, documentId);
  if (units.length === 0) return null;

  // One memory per document, so a single returned unit is an unambiguous match.
  if (units.length === 1 && units[0]) {
    await memoryRepo.setHindsightMemoryId(memoryRefId, units[0].id);
    return units[0].id;
  }

  let best: { id: string; score: number } | null = null;
  for (const u of units) {
    const score = similarity(statement, u.text);
    if (!best || score > best.score) best = { id: u.id, score };
  }

  if (!best || best.score < 0.4) {
    logger.debug('no confident memory id match', { documentId, bestScore: best?.score ?? 0 });
    return null;
  }

  await memoryRepo.setHindsightMemoryId(memoryRefId, best.id);
  return best.id;
}
