import type { RecalledMemory } from '../hindsight/recall.js';

/**
 * Order memories for the LLM context: most recent first within the categories
 * that most constrain the work. Rejections lead because violating one is the
 * most visible failure.
 *
 * Deliberately NOT an LLM step. Ordering by the `type:` tag is mechanical, and
 * doing it in code is part of what makes the Why/evidence feature trustworthy.
 */
export function orderForContext(memories: RecalledMemory[]): RecalledMemory[] {
  const weight = (m: RecalledMemory): number => {
    switch (m.memoryType) {
      case 'rejection': return 0;
      case 'constraint': return 1;
      case 'preference_change': return 2;
      case 'approval': return 3;
      case 'preference': return 4;
      case 'decision': return 5;
      case 'outcome': return 6;
      default: return 7;
    }
  };

  return [...memories].sort((a, b) => {
    const w = weight(a) - weight(b);
    if (w !== 0) return w;
    const ta = Date.parse(a.occurredAt ?? a.mentionedAt ?? '') || 0;
    const tb = Date.parse(b.occurredAt ?? b.mentionedAt ?? '') || 0;
    return tb - ta;
  });
}
