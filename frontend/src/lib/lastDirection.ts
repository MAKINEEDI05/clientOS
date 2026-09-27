/**
 * Remembers the summary of the last direction generated for a project.
 *
 * Needed because the natural flow leaves the AI workspace — generate a
 * direction, go and record the client's new feedback, come back and resolve the
 * conflict — which unmounts the page and would otherwise lose the "before" side
 * of the comparison.
 *
 * Only the summary string is kept, and only for the session: enough to show an
 * honest before/after, never enough to re-display a stale recommendation as if
 * it were current. All access is guarded — sessionStorage throws in some
 * privacy modes.
 */
const KEY = 'clientos:last-direction:';

export function rememberDirection(projectId: string, summary: string): void {
  if (!projectId) return;
  try {
    sessionStorage.setItem(KEY + projectId, summary);
  } catch {
    /* storage unavailable — the before/after simply will not render */
  }
}

export function recallDirection(projectId: string): string | null {
  if (!projectId) return null;
  try {
    return sessionStorage.getItem(KEY + projectId);
  } catch {
    return null;
  }
}

export function forgetDirection(projectId: string): void {
  if (!projectId) return;
  try {
    sessionStorage.removeItem(KEY + projectId);
  } catch {
    /* nothing to do */
  }
}
