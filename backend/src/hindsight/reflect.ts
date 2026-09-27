import { getHindsight, toMemoryError } from './client.js';
import { projectScopeTagGroups } from './tags.js';
import { logger } from '../utils/logger.js';

/**
 * Reflect — Hindsight's agentic reasoning over retained memory, guided by the
 * bank's mission, directives and disposition.
 *
 * ClientOS uses `recall` + Groq for recommendations (exact per-bullet citations,
 * and Groq is the locked stack). Reflect powers the "Client Standing Brief"
 * panel, which exercises Hindsight's third pillar genuinely rather than
 * name-dropping it.
 *
 * `includeFacts: true` is required for `based_on` to be populated.
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
