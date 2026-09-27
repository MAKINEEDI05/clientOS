import { getHindsight, toMemoryError } from './client.js';
import { logger } from '../utils/logger.js';

/**
 * One Hindsight bank per client (HINDSIGHT_INTEGRATION_MAP.md §3.1).
 *
 * Banks are fully isolated — "data stored in one is invisible to another" — which
 * is what guarantees cross-client memory isolation. Project separation is a tag
 * filter within a client's bank, not a separate bank.
 */

export interface EnsureBankInput {
  bankId: string;
  clientName: string;
  clientContext?: string | null;
}

/**
 * Create or update a client's bank with the missions that steer extraction and
 * reasoning. Safe to call repeatedly — createBank is create-or-update.
 *
 * Only non-deprecated options are used: `name`, `mission`, `background` and the
 * `disposition` object are all @deprecated in the SDK, and getBankProfile is
 * removed server-side (answers 410), so we use reflectMission/retainMission and
 * getBankConfig instead.
 */
export async function ensureBank(input: EnsureBankInput): Promise<void> {
  const { bankId, clientName, clientContext } = input;
  try {
    await getHindsight().createBank(bankId, {
      retainMission:
        'Extract durable client decisions about design and web projects: explicit ' +
        'preferences, approvals, rejections, constraints, decisions and outcomes. ' +
        'Record what was decided and which interaction it came from. Ignore greetings, ' +
        'scheduling, pleasantries and casual conversation.',
      reflectMission:
        `You hold the decision history for the client "${clientName}".` +
        (clientContext ? ` Context: ${clientContext}` : '') +
        ' Answer only from retained memory about what this client has approved, rejected, ' +
        'preferred or constrained. If memory does not cover something, say so rather than guessing.',
      observationsMission:
        'Consolidate repeated client signals into durable standing preferences, noting ' +
        'when a preference supersedes an earlier one.',
      enableObservations: true,
    });
    logger.info('hindsight bank ensured', { bankId });
  } catch (e) {
    throw toMemoryError(e, 'createBank');
  }
}

export async function getBankConfig(bankId: string): Promise<unknown> {
  try {
    return await getHindsight().getBankConfig(bankId);
  } catch (e) {
    throw toMemoryError(e, 'getBankConfig');
  }
}

/**
 * Destructive. Only used by the token-guarded demo reset so a demo can be
 * returned to a known state.
 */
export async function deleteBank(bankId: string): Promise<void> {
  try {
    await getHindsight().deleteBank(bankId);
    logger.warn('hindsight bank deleted', { bankId });
  } catch (e) {
    // A missing bank is an acceptable outcome for a reset.
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404) {
      logger.info('hindsight bank already absent', { bankId });
      return;
    }
    throw toMemoryError(e, 'deleteBank');
  }
}
