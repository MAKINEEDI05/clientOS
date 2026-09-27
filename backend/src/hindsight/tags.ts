import type { MemoryScope, MemoryType } from '../types/domain.js';

/**
 * Hindsight tag vocabulary. Tags are how ClientOS represents scope: per the
 * Hindsight developer docs, "memories only return if tags intersect with recall
 * filters", which makes them the real mechanism behind project/client scoping.
 *
 * Every memory ClientOS writes carries client:, project:, type: and scope: tags,
 * plus source: when it came from a named interaction.
 */

export const TagPrefix = {
  client: 'client:',
  project: 'project:',
  type: 'type:',
  scope: 'scope:',
  source: 'source:',
  status: 'status:',
} as const;

export const clientTag = (clientSlug: string) => `${TagPrefix.client}${clientSlug}`;
export const projectTag = (projectSlug: string) => `${TagPrefix.project}${projectSlug}`;
export const typeTag = (t: MemoryType) => `${TagPrefix.type}${t}`;
export const scopeTag = (s: MemoryScope) => `${TagPrefix.scope}${s}`;
export const sourceTag = (labelSlug: string) => `${TagPrefix.source}${labelSlug}`;
export const SUPERSEDED_TAG = `${TagPrefix.status}superseded`;

export interface BuildTagsInput {
  clientSlug: string;
  projectSlug?: string | null;
  memoryType: MemoryType;
  scope: MemoryScope;
  sourceLabelSlug?: string | null;
  extra?: string[];
}

/** Canonical tag set for one retained memory. Deduplicated and stable-ordered. */
export function buildMemoryTags(input: BuildTagsInput): string[] {
  const tags = [
    clientTag(input.clientSlug),
    typeTag(input.memoryType),
    scopeTag(input.scope),
  ];
  // Client-wide and future-scoped memories deliberately carry no project tag,
  // so they are not filtered out when another project is in context.
  if (input.projectSlug && input.scope !== 'client' && input.scope !== 'future') {
    tags.push(projectTag(input.projectSlug));
  }
  if (input.sourceLabelSlug) tags.push(sourceTag(input.sourceLabelSlug));
  if (input.extra) tags.push(...input.extra);
  return [...new Set(tags)];
}

/** Read one namespaced value back off a recalled memory's tags. */
export function readTag(tags: readonly string[] | null | undefined, prefix: string): string | null {
  if (!tags) return null;
  const hit = tags.find((t) => t.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

/**
 * Recall filter for "this project, plus anything client-wide or future-scoped".
 *
 * `any_strict` is required because the SDK default (`any`) also returns UNTAGGED
 * memories, which would leak memories from other projects into this context.
 */
export function projectScopeTagGroups(projectSlug: string) {
  return [
    {
      or: [
        { tags: [projectTag(projectSlug)], match: 'any_strict' as const },
        { tags: [scopeTag('client')], match: 'any_strict' as const },
        { tags: [scopeTag('future')], match: 'any_strict' as const },
      ],
    },
  ];
}

/** Recall filter for everything belonging to one client (all projects). */
export function clientScopeTagGroups(clientSlug: string) {
  return [{ tags: [clientTag(clientSlug)], match: 'any_strict' as const }];
}
