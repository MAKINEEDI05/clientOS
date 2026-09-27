import type { MemoryScope } from '../types/api';

/**
 * User-facing scope wording.
 *
 * Deliberately product language. Nothing here exposes how scope is enforced
 * underneath (tags, match modes, bank ids) — that is an implementation detail.
 */
const LABELS: Record<MemoryScope, string> = {
  interaction: 'This interaction',
  revision: 'This revision',
  project: 'This project',
  client: 'Client-wide',
  future: 'All future projects',
};

const EXPLAINERS: Record<MemoryScope, string> = {
  interaction: 'Applies to this interaction only. It will not shape other work.',
  revision: 'Applies to this revision only.',
  project: 'Applies to this project. Other projects for this client are unaffected.',
  client: "Applies across this client's work, including future projects.",
  future: "Applies to this client's future projects as their current preference.",
};

export function scopeLabel(scope: MemoryScope | 'unknown'): string {
  return scope === 'unknown' ? 'Unscoped' : LABELS[scope];
}

export function scopeExplainer(scope: MemoryScope | 'unknown'): string {
  return scope === 'unknown' ? 'No scope was recorded for this memory.' : EXPLAINERS[scope];
}

/** True for scopes that reach beyond the current project. */
export function isBroadScope(scope: MemoryScope | 'unknown'): boolean {
  return scope === 'client' || scope === 'future';
}
