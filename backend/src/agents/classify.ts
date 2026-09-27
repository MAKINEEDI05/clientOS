import type { RecalledMemory } from '../hindsight/recall.js';

/**
 * Partition recalled memories by their ClientOS `type:` tag.
 *
 * Deliberately NOT an LLM step. Partitioning by tag is mechanical, and doing it
 * in code is what makes the Why/evidence feature trustworthy.
 */
export interface ClassifiedMemory {
  preferences: RecalledMemory[];
  approvals: RecalledMemory[];
  rejections: RecalledMemory[];
  constraints: RecalledMemory[];
  decisions: RecalledMemory[];
  outcomes: RecalledMemory[];
  changes: RecalledMemory[];
  /** Memories whose category tag was missing or unrecognised. */
  uncategorised: RecalledMemory[];
  all: RecalledMemory[];
}

export function classifyMemories(memories: RecalledMemory[]): ClassifiedMemory {
  const out: ClassifiedMemory = {
    preferences: [],
    approvals: [],
    rejections: [],
    constraints: [],
    decisions: [],
    outcomes: [],
    changes: [],
    uncategorised: [],
    all: memories,
  };

  for (const m of memories) {
    switch (m.memoryType) {
      case 'preference': out.preferences.push(m); break;
      case 'approval': out.approvals.push(m); break;
      case 'rejection': out.rejections.push(m); break;
      case 'constraint': out.constraints.push(m); break;
      case 'decision': out.decisions.push(m); break;
      case 'outcome': out.outcomes.push(m); break;
      case 'preference_change': out.changes.push(m); break;
      default: out.uncategorised.push(m); break;
    }
  }

  return out;
}

/**
 * Order memories for the LLM context: most recent first within the categories
 * that most constrain the work. Rejections lead because violating one is the
 * most visible failure.
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
