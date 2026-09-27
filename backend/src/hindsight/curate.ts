import { getRawHindsight, hindsightSdk, toMemoryError } from './client.js';
import { logger } from '../utils/logger.js';

/**
 * Memory curation. Verified endpoint:
 *   PATCH /v1/default/banks/{bank_id}/memories/{memory_id}
 *
 * Reached through the generated SDK function `sdk.updateMemory`, because
 * HindsightClient does not expose curation as a method and keeps its internal
 * transport private.
 *
 * Hindsight's invalidation model is exactly what a superseded preference needs:
 * an invalidated memory "disappears from recall, consolidation, and the knowledge
 * graph" while remaining "auditable and restorable". Nothing is ever deleted, so
 * history is preserved (PRODUCT_DECISIONS.md Decision 3).
 *
 * Constraint: only world/experience facts can be curated. Observations are
 * derived and are re-consolidated by Hindsight instead.
 */

export async function invalidateMemory(
  bankId: string,
  memoryId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const result = await hindsightSdk.updateMemory({
      client: getRawHindsight(),
      path: { bank_id: bankId, memory_id: memoryId },
      body: { state: 'invalidated', reason: reason.slice(0, 500) },
    });

    if ((result as { error?: unknown }).error) {
      const err = (result as { error?: unknown }).error;
      logger.warn('hindsight invalidate rejected', { bankId, memoryId, error: String(err) });
      return { ok: false, reason: 'memory service rejected the curation request' };
    }

    logger.info('hindsight memory invalidated', { bankId, memoryId });
    return { ok: true };
  } catch (e) {
    throw toMemoryError(e, 'updateMemory:invalidate');
  }
}

/** Restore a previously invalidated memory. Invalidation is reversible by design. */
export async function restoreMemory(bankId: string, memoryId: string): Promise<void> {
  try {
    await hindsightSdk.updateMemory({
      client: getRawHindsight(),
      path: { bank_id: bankId, memory_id: memoryId },
      body: { state: 'valid', reason: 'restored by ClientOS' },
    });
    logger.info('hindsight memory restored', { bankId, memoryId });
  } catch (e) {
    throw toMemoryError(e, 'updateMemory:restore');
  }
}
