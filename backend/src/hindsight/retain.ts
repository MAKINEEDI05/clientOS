import { getHindsight, toMemoryError } from './client.js';
import { buildMemoryTags } from './tags.js';
import type { MemoryScope, MemoryType } from '../types/domain.js';
import { logger } from '../utils/logger.js';

/** One durable memory to write to Hindsight. */
export interface RetainMemoryInput {
  /** Self-contained third-person statement, e.g. "The client rejected heavy animation." */
  statement: string;
  memoryType: MemoryType;
  scope: MemoryScope;
  clientSlug: string;
  projectSlug?: string | null;
  /** Interaction label, e.g. "Revision #3" — becomes Hindsight `context`. */
  contextLabel?: string | null;
  sourceLabelSlug?: string | null;
  occurredAt?: Date | null;
  /** Groups memories under one logical document; enables idempotent upserts. */
  documentId?: string | null;
  metadata?: Record<string, string>;
  extraTags?: string[];
}

export interface RetainResult {
  itemsCount: number;
  tags: string[];
  documentId: string | null;
}

function tagsFor(input: RetainMemoryInput): string[] {
  return buildMemoryTags({
    clientSlug: input.clientSlug,
    projectSlug: input.projectSlug ?? null,
    memoryType: input.memoryType,
    scope: input.scope,
    sourceLabelSlug: input.sourceLabelSlug ?? null,
    extra: input.extraTags,
  });
}

/**
 * Retain one memory into a client's bank.
 *
 * `async: false` is deliberate — the UI must be able to state truthfully that the
 * memory was stored before the next recall runs.
 *
 * Note retain does NOT return per-memory ids: Hindsight extracts facts from the
 * content rather than storing it verbatim, so one item may yield several facts or
 * none. Ids are reconciled afterwards via listMemoriesByDocument().
 */
export async function retainForBank(bankId: string, input: RetainMemoryInput): Promise<RetainResult> {
  const tags = tagsFor(input);

  try {
    const res = await getHindsight().retain(bankId, input.statement, {
      ...(input.contextLabel ? { context: input.contextLabel } : {}),
      ...(input.occurredAt ? { timestamp: input.occurredAt } : {}),
      ...(input.documentId ? { documentId: input.documentId } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      tags,
      async: false,
    });

    logger.info('hindsight retain ok', {
      bankId,
      itemsCount: res.items_count,
      memoryType: input.memoryType,
      scope: input.scope,
      tags,
    });

    return { itemsCount: res.items_count ?? 0, tags, documentId: input.documentId ?? null };
  } catch (e) {
    throw toMemoryError(e, 'retain');
  }
}

/**
 * Retain several memories in one call. Used for demo seeding so the eight
 * interactions land without eight round trips.
 */
export async function retainBatchForBank(
  bankId: string,
  items: RetainMemoryInput[],
  options?: { documentId?: string; documentTags?: string[] },
): Promise<{ itemsCount: number; tagsPerItem: string[][] }> {
  if (items.length === 0) return { itemsCount: 0, tagsPerItem: [] };

  const tagsPerItem = items.map(tagsFor);

  try {
    const res = await getHindsight().retainBatch(
      bankId,
      items.map((input, i) => ({
        content: input.statement,
        ...(input.contextLabel ? { context: input.contextLabel } : {}),
        ...(input.occurredAt ? { timestamp: input.occurredAt.toISOString() } : {}),
        ...(input.documentId ? { document_id: input.documentId } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
        tags: tagsPerItem[i] ?? [],
      })),
      {
        ...(options?.documentId ? { documentId: options.documentId } : {}),
        ...(options?.documentTags ? { documentTags: options.documentTags } : {}),
        async: false,
      },
    );

    logger.info('hindsight retainBatch ok', { bankId, itemsCount: res.items_count });
    return { itemsCount: res.items_count ?? items.length, tagsPerItem };
  } catch (e) {
    throw toMemoryError(e, 'retainBatch');
  }
}
