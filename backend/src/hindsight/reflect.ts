import { getHindsight, toMemoryError } from './client.js';
import { projectScopeTagGroups } from './tags.js';
import { logger } from '../utils/logger.js';

/**
 * NOT WIRED IN. This file has no caller, no route and no UI, and has never been
 * executed. Do not cite it as a capability ClientOS uses.
 *
 * Reflect is Hindsight's agentic reasoning over retained memory. ClientOS
 * deliberately uses `recall` + Groq instead, because recall returns every memory
 * with its id and so each recommendation line can be bound to specific memories;
 * reflect's `based_on` is flat for the whole answer, which would make per-line
 * "Why?" approximate. See docs/PRODUCT_DECISIONS.md Decision 10.
 *
 * Kept as a starting point if a standing-brief feature is ever built. If it is,
 * `includeFacts: true` is required for `based_on` to be populated — that is the
 * one non-obvious thing this file records.
 */

export interface StandingBrief {
  text: string;
  basedOn: Array<{ id: string | null; text: string; type: string | null }>;
  directivesApplied: Array<{ id: string; name: string; content: string }>;
}

export async function reflectStandingBrief(
  bankId: string,
  projectSlug: string,
  clientName: string,
): Promise<StandingBrief> {
  try {
    const res = await getHindsight().reflect(
      bankId,
      `Summarise ${clientName}'s standing design preferences, what they have approved, ` +
        `and what they have explicitly rejected. Be concise and only use retained memory.`,
      {
        budget: 'low',
        tagGroups: projectScopeTagGroups(projectSlug),
        includeFacts: true,
      },
    );

    const basedOn = (res.based_on?.memories ?? []).map((m) => ({
      id: m.id ?? null,
      text: m.text,
      type: m.type ?? null,
    }));
    const directivesApplied = (res.based_on?.directives ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      content: d.content,
    }));

    if (res.structured_output_error) {
      logger.warn('hindsight reflect structured output error', {
        bankId,
        error: res.structured_output_error,
      });
    }

    logger.info('hindsight reflect ok', {
      bankId,
      memoriesUsed: basedOn.length,
      directivesUsed: directivesApplied.length,
    });

    return { text: res.text ?? '', basedOn, directivesApplied };
  } catch (e) {
    throw toMemoryError(e, 'reflect');
  }
}
