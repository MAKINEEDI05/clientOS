/**
 * The last direction generated with client memory switched OFF.
 *
 * Kept so that generating the same request again WITH memory can show the two
 * real answers side by side, instead of asking the viewer to remember the first
 * one. Only ever holds output the backend actually returned.
 *
 * A sibling of lastDirection.ts rather than an extension of it: that one is keyed
 * by project alone and serves the conflict before/after. This needs client,
 * project AND request identity, because a baseline is only meaningful for the
 * exact question it answered.
 *
 * Session-scoped and guarded, for the same reasons as lastDirection: it is demo
 * and comparison context, never a source of truth, and sessionStorage throws in
 * some privacy modes.
 */
const KEY = 'clientos:memory-off:';

export interface MemoryOffBaseline {
  /** The normalised request this answered. Compared before anything is shown. */
  request: string;
  /** The summary the backend returned. Never rewritten or summarised again. */
  summary: string;
  /** Identity of the stored recommendation, so it is traceable to a real record. */
  recommendationId: string;
}

/**
 * Requests match on normalised text, not similarity.
 *
 * Deliberately crude: case, surrounding space, repeated space and trailing
 * punctuation are ignored, and nothing else. Anything cleverer risks pairing two
 * genuinely different questions, and showing an unrelated comparison is worse
 * than showing none.
 */
export function normaliseRequest(request: string): string {
  return request.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.?!\s]+$/, '');
}

function keyFor(clientId: string, projectId: string): string {
  return `${KEY}${clientId}:${projectId}`;
}

/**
 * Record a memory-off result as the baseline for its client, project and request.
 *
 * One baseline per client+project: a later answer to the same question replaces
 * the earlier one, and an answer to a different question invalidates the old
 * baseline rather than sitting alongside it pretending to be current.
 */
export function rememberMemoryOff(
  clientId: string,
  projectId: string,
  request: string,
  summary: string,
  recommendationId: string,
): void {
  if (!clientId || !projectId || !summary) return;
  try {
    const entry: MemoryOffBaseline = {
      request: normaliseRequest(request),
      summary,
      recommendationId,
    };
    sessionStorage.setItem(keyFor(clientId, projectId), JSON.stringify(entry));
  } catch {
    /* storage unavailable — the comparison simply will not render */
  }
}

/**
 * The baseline for this exact context, or null.
 *
 * Returns null unless the client, the project AND the request all match. Client
 * and project are enforced by the key, so a baseline from another workspace is
 * not merely filtered out — it is never read.
 */
export function recallMemoryOff(
  clientId: string,
  projectId: string,
  request: string,
): MemoryOffBaseline | null {
  if (!clientId || !projectId) return null;
  try {
    const raw = sessionStorage.getItem(keyFor(clientId, projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const entry = parsed as Partial<MemoryOffBaseline>;
    if (typeof entry.request !== 'string' || typeof entry.summary !== 'string') return null;
    if (entry.request !== normaliseRequest(request)) return null;
    return {
      request: entry.request,
      summary: entry.summary,
      recommendationId: typeof entry.recommendationId === 'string' ? entry.recommendationId : '',
    };
  } catch {
    // Unparseable or unavailable storage: no comparison, rather than a bad one.
    return null;
  }
}

export function forgetMemoryOff(clientId: string, projectId: string): void {
  if (!clientId || !projectId) return;
  try {
    sessionStorage.removeItem(keyFor(clientId, projectId));
  } catch {
    /* nothing to do */
  }
}
