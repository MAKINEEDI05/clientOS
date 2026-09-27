import { MEMORY_TYPES } from '../../types/domain.js';

/**
 * Durable memory extraction.
 *
 * The hard requirement: do NOT invent a preference. "Make it better" must never
 * become "the client prefers minimal design" (edge case 2.2 / 6.2).
 */
export const EXTRACT_SYSTEM = `You extract durable client decisions from feedback for an agency memory system.

You are given raw feedback from a client interaction. Identify ONLY statements that represent durable, reusable decisions.

DURABLE (extract these):
- preference        an explicit stated preference ("keep headlines shorter")
- approval          an explicit approval ("the serif direction works, keep it")
- rejection         an explicit rejection ("the animations are too much")
- decision          a concrete decision about direction or approach
- constraint        a rule that restricts future work ("must be mobile-first")
- outcome           a meaningful result of previous work
- preference_change an explicit change to a previously stated preference

NON-DURABLE (put these in "discarded" with a reason):
- greetings, pleasantries, thanks, small talk
- scheduling and logistics
- vague statements with no usable content ("make it better", "not quite right", "hmm")
- speculation or hypotheticals ("maybe we'd consider...")
- questions that carry no preference
- restatements of what the agency said

ABSOLUTE RULES:
1. NEVER invent a preference that is not stated. Vague input yields NO candidates — put it in "discarded".
2. "sourceQuote" MUST be copied VERBATIM from the input text, character for character. Do not paraphrase it, do not fix its spelling, do not add quotation marks around it. It is machine-verified against the input and your candidate is discarded if it does not match exactly.
3. "statement" MUST be self-contained third person, understandable months later with no surrounding context. Write "The client rejected heavy animation", never "too much".
4. "statement" MUST NOT mention the interaction name or number. Provenance is tracked separately.
5. One message may contain SEVERAL distinct signals (for example an approval AND a rejection). Extract each separately with its own quote.
6. "confidence" reflects how explicit the statement is: 0.9+ for an unambiguous explicit statement, 0.6-0.8 for clear but less direct, below 0.6 for weak or implied. A single casual mention is not a strong preference.
7. "scopeHint": use "client" ONLY if the client explicitly indicates it applies broadly ("we generally prefer", "on all our work", "all future projects"). Use "interaction" for an explicit one-off ("for this design only", "just this once"). Use "project" for normal project feedback. Use "unknown" if genuinely unclear.

Respond with ONLY a JSON object:
{
  "candidates": [
    { "type": "<${MEMORY_TYPES.join('|')}>", "statement": "...", "sourceQuote": "...", "scopeHint": "interaction|revision|project|client|unknown", "confidence": 0.0 }
  ],
  "discarded": [ { "text": "...", "reason": "..." } ]
}

If nothing durable is present, return {"candidates": [], "discarded": [...]}.`;

export function buildExtractUser(input: {
  clientName: string;
  projectName: string;
  interactionLabel: string;
  source: string;
  content: string;
}): string {
  return `Client: ${input.clientName}
Project: ${input.projectName}
Interaction: ${input.interactionLabel} (${input.source})

Client feedback (extract only from this text):
"""
${input.content}
"""`;
}
