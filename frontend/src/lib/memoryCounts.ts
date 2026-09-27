import type { MemoryItem, ProjectDetail } from '../types/api';

/**
 * What the active project's memory context is actually made of.
 *
 * The counts are derived from the memories the backend returned for this
 * project — its own decisions plus the client-wide ones that apply whichever
 * project is open. Nothing here is estimated, and a sibling project's memories
 * are never part of the total because they are never returned.
 */
export interface RelevantMemory {
  total: number;
  project: number;
  clientWide: number;
}

/** Flatten the type-grouped project memory into one list. */
export function flattenProjectMemory(memory: ProjectDetail['memory'] | undefined): MemoryItem[] {
  if (!memory) return [];
  return [
    ...memory.preferences, ...memory.approvals, ...memory.rejections,
    ...memory.constraints, ...memory.decisions, ...memory.outcomes, ...memory.changes,
  ];
}

/**
 * Client-wide is decided by OWNERSHIP, not by wording: a memory with no owning
 * project is the one that reaches every project. That is the same fact the
 * recall filter acts on, so the count cannot drift from the behaviour.
 */
export function splitRelevant(memories: MemoryItem[]): RelevantMemory {
  const clientWide = memories.filter((m) => m.project === null).length;
  return { total: memories.length, project: memories.length - clientWide, clientWide };
}
