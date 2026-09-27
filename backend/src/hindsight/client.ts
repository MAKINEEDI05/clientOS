import {
  HindsightClient,
  HindsightError,
  createClient,
  createConfig,
  sdk,
} from '@vectorize-io/hindsight-client';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Real Hindsight Cloud integration.
 *
 * Verified surface (see HINDSIGHT_INTEGRATION_MAP.md §0 for provenance):
 *   base URL  https://api.hindsight.vectorize.io
 *   auth      Authorization: Bearer hsk_...
 *   paths     /v1/{tenant}/banks/{bank_id}/...
 *
 * There is no local/mock memory implementation anywhere in this codebase. When
 * Hindsight is unconfigured or unreachable, callers receive
 * AppError.memoryUnavailable and ClientOS reports that history could not be used.
 */

let singleton: HindsightClient | null = null;

/** High-level SDK client. Throws if Hindsight is not configured. */
export function getHindsight(): HindsightClient {
  if (!env.hindsightConfigured) {
    throw AppError.memoryUnavailable('HINDSIGHT_API_KEY is not configured');
  }
  if (!singleton) {
    singleton = new HindsightClient({
      baseUrl: env.HINDSIGHT_BASE_URL,
      apiKey: env.HINDSIGHT_API_KEY,
      userAgent: 'ClientOS/1.0',
      // Retries 429/503 with Retry-After honoured. Writes are never retried by
      // the SDK, which is why retain failures are persisted as retryable state.
      maxAttempts: 3,
    });
  }
  return singleton;
}

let rawClient: ReturnType<typeof createClient> | null = null;

/**
 * Low-level generated client, needed for operations the high-level
 * HindsightClient does not expose as methods (memory curation, bank listing).
 * HindsightClient keeps its internal client private, so we build our own.
 */
export function getRawHindsight() {
  if (!env.hindsightConfigured) {
    throw AppError.memoryUnavailable('HINDSIGHT_API_KEY is not configured');
  }
  if (!rawClient) {
    rawClient = createClient(
      createConfig({
        baseUrl: env.HINDSIGHT_BASE_URL,
        headers: {
          Authorization: `Bearer ${env.HINDSIGHT_API_KEY}`,
          'User-Agent': 'ClientOS/1.0',
        },
      }),
    );
  }
  return rawClient;
}

export { sdk as hindsightSdk, HindsightError };

export function isHindsightError(e: unknown): e is HindsightError {
  return e instanceof HindsightError;
}

/** HTTP status from a Hindsight failure, when the SDK provides one. */
export function hindsightStatus(e: unknown): number | undefined {
  return isHindsightError(e) ? e.statusCode : undefined;
}

/**
 * Normalise any Hindsight failure into an AppError whose message never implies
 * that memory was used, and never leaks credentials or internals.
 */
export function toMemoryError(e: unknown, operation: string): AppError {
  if (e instanceof AppError) return e;

  const status = hindsightStatus(e);
  const message = e instanceof Error ? e.message : String(e);

  logger.error('hindsight operation failed', { operation, status, error: message });

  if (status === 401 || status === 403) {
    return AppError.memoryUnavailable('memory service rejected our credentials', { operation });
  }
  if (status === 404) {
    return AppError.memoryUnavailable('memory bank not found', { operation, status });
  }
  if (status === 429) {
    return AppError.memoryUnavailable('memory service is rate limited', { operation });
  }
  if (status && status >= 500) {
    return AppError.memoryUnavailable('memory service is temporarily unavailable', { operation, status });
  }
  if (/abort|timeout/i.test(message)) {
    return AppError.memoryUnavailable('memory service timed out', { operation });
  }
  return AppError.memoryUnavailable('memory service could not be reached', { operation });
}

/**
 * Connection probe. Returns a verdict rather than throwing, so the health
 * endpoint can always render a badge.
 *
 * This deliberately performs an AUTHENTICATED call (listBanks) rather than
 * getVersion: getVersion answers without credentials, so relying on it would
 * report "memory connected" while every real operation failed with a 401 —
 * exactly the false reassurance ClientOS must never give.
 */
export async function probeHindsight(): Promise<
  { connected: true; version: string } | { connected: false; reason: string }
> {
  if (!env.hindsightConfigured) {
    return { connected: false, reason: 'HINDSIGHT_API_KEY is not configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const probe = await sdk.listBanks({
      client: getRawHindsight(),
      signal: controller.signal,
      throwOnError: false,
    });

    const status = (probe as { response?: { status?: number } }).response?.status;
    if (status === 401 || status === 403) {
      return { connected: false, reason: 'credentials rejected by memory service' };
    }
    if (status && status >= 500) {
      return { connected: false, reason: 'memory service is temporarily unavailable' };
    }
    if ((probe as { error?: unknown }).error) {
      return { connected: false, reason: 'memory service returned an error' };
    }

    // Version is informational only and must not gate the verdict.
    let version = 'unknown';
    try {
      const v = await getHindsight().getVersion({ signal: controller.signal });
      version = (v as { version?: string })?.version ?? 'unknown';
    } catch {
      /* ignore — auth already proven above */
    }
    return { connected: true, version };
  } catch (e) {
    const status = hindsightStatus(e);
    if (status === 401 || status === 403) {
      return { connected: false, reason: 'credentials rejected by memory service' };
    }
    const message = e instanceof Error ? e.message : String(e);
    if (/abort|timeout/i.test(message)) {
      return { connected: false, reason: 'memory service timed out' };
    }
    return { connected: false, reason: 'memory service could not be reached' };
  } finally {
    clearTimeout(timer);
  }
}

/** Reset cached clients. Test-only. */
export function __resetHindsightClients(): void {
  singleton = null;
  rawClient = null;
}
