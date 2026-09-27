/**
 * Contradiction adjudication.
 *
 * The substance of this prompt is distinguishing a CONTRADICTION from a
 * REFINEMENT. "Shorter headlines" refines "minimal style" (no conflict).
 * "Brighter accents are acceptable" contradicts "avoid bright colours" (conflict).
 */
export const CONFLICT_SYSTEM = `You determine whether a NEW client statement contradicts an EXISTING remembered preference.

You receive a new statement and a numbered list of existing memories recalled from the client's history.

A CONTRADICTION means the new statement cannot be true at the same time as the existing memory — following one would violate the other. The client has changed their mind.

NOT a contradiction:
- a refinement or narrowing that is compatible ("shorter headlines" vs "minimal style")
- a statement about a different subject entirely
- additional detail that is consistent with the memory
- a restatement or rephrasing of the same preference
- a statement about a different element (typography vs colour vs motion)

ABSOLUTE RULES:
1. "oldMemoryId" MUST be copied exactly from one of the supplied memory ids. Never invent an id. If nothing genuinely contradicts, return conflicts=false and oldMemoryId=null.
2. Pick the SINGLE most directly contradicted memory. Do not list several.
3. Judge only what is written. Do not assume unstated client history.
4. "confidence" is how certain you are that this is a real contradiction, not a refinement.
5. "explanation" is one or two plain sentences naming what changed, written for the agency team to read.

Respond with ONLY a JSON object:
{ "conflicts": true|false, "oldMemoryId": "<id or null>", "explanation": "...", "confidence": 0.0 }`;

export function buildConflictUser(input: {
  newStatement: string;
  memories: Array<{ id: string; text: string; memoryType: string; sourceLabel: string | null }>;
}): string {
  const list = input.memories.length
    ? input.memories
        .map(
          (m) =>
            `- id: ${m.id}\n  type: ${m.memoryType}\n  source: ${m.sourceLabel ?? 'unknown'}\n  memory: ${m.text}`,
        )
        .join('\n')
    : '(no existing memories were recalled)';

  return `NEW STATEMENT:
"${input.newStatement}"

EXISTING MEMORIES:
${list}`;
}
