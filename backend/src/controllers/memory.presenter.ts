import type { TimelineMemory, LinkPair } from '../repositories/memory.repo.js';
import { humaniseLabel } from '../agents/evidence.js';

/**
 * Shape a timeline memory for the UI, attaching supersession edges so the
 * "old preference preserved, new preference current" story is visible.
 */
export function presentMemory(m: TimelineMemory, links: LinkPair[]) {
  const supersedes = links
    .filter((l) => l.from_memory_ref_id === m.id && l.relation === 'supersedes')
    .map((l) => ({ memoryRefId: l.to_memory_ref_id, statement: l.to_statement, scope: l.scope }));

  const supersededByLink = links.find(
    (l) => l.to_memory_ref_id === m.id && l.relation === 'supersedes',
  );

  return {
    id: m.id,
    hindsightMemoryId: m.hindsight_memory_id,
    memoryType: m.memory_type,
    statement: m.statement,
    scope: m.scope,
    state: m.state,
    tags: m.tags,
    confidence: m.confidence === null ? null : Number(m.confidence),
    sourceQuote: m.source_quote,
    occurredAt: m.interaction_occurred_at ?? m.created_at,
    interaction: m.interaction_label
      ? {
          id: m.interaction_id,
          label: m.interaction_label,
          labelDisplay: m.interaction_label,
          source: m.interaction_source,
        }
      : null,
    sourceLabelDisplay: m.interaction_label ?? null,
    supersedes,
    supersededBy: supersededByLink
      ? {
          memoryRefId: supersededByLink.from_memory_ref_id,
          statement: supersededByLink.from_statement,
          scope: supersededByLink.scope,
        }
      : null,
  };
}

export { humaniseLabel };
