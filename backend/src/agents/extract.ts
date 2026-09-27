import { completeJSON } from '../llm/groq.js';
import { extractionResultSchema, type ExtractionCandidate } from '../llm/schemas.js';
import { EXTRACT_SYSTEM, buildExtractUser } from '../llm/prompts/extract.prompt.js';
import type { MemoryScope, MemoryType } from '../types/domain.js';
import { logger } from '../utils/logger.js';

/** A candidate that survived the durability gate and is ready to retain. */
export interface DurableCandidate {
  memoryType: MemoryType;
  statement: string;
  sourceQuote: string;
  /** Scope actually assigned (may be narrower than the model's hint). */
  scope: MemoryScope;
  /** True when scope could not be safely inferred and the user should confirm. */
  needsScopeConfirmation: boolean;
  confidence: number;
}

export interface DiscardedCandidate {
  text: string;
  reason: string;
}

export interface ExtractionOutcome {
  durable: DurableCandidate[];
  discarded: DiscardedCandidate[];
}

/** Minimum confidence for a candidate to become durable memory. */
export const MIN_DURABLE_CONFIDENCE = 0.6;

const MIN_STATEMENT = 10;
const MAX_STATEMENT = 300;

/** Normalise whitespace and quote characters for verbatim comparison. */
function normaliseForQuoteCheck(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛′‵]/g, "'")
    .replace(/[“”„‟″‶]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseStatement(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Map the model's scope hint onto an actual scope.
 *
 * Deliberately conservative: a claim of client-wide scope is HELD for user
 * confirmation and stored provisionally at project scope. A memory that should
 * have been client-wide merely under-applies; a wrongly client-wide memory
 * silently contaminates every future project. That asymmetry is why the default
 * is narrow (MASTER_SPEC §2, PRODUCT_DECISIONS.md Decision 4).
 */
function resolveScope(hint: ExtractionCandidate['scopeHint']): {
  scope: MemoryScope;
  needsScopeConfirmation: boolean;
} {
  switch (hint) {
    case 'interaction':
      return { scope: 'interaction', needsScopeConfirmation: false };
    case 'revision':
      return { scope: 'revision', needsScopeConfirmation: false };
    case 'project':
      return { scope: 'project', needsScopeConfirmation: false };
    case 'client':
      return { scope: 'project', needsScopeConfirmation: true };
    case 'unknown':
    default:
      return { scope: 'project', needsScopeConfirmation: true };
  }
}

/**
 * Deterministic durability gate applied AFTER the LLM.
 *
 * This is where fabrication is stopped: a candidate whose sourceQuote is not
 * literally present in the input is dropped, regardless of how confident the
 * model claimed to be.
 */
export function applyDurabilityGate(
  candidates: ExtractionCandidate[],
  interactionContent: string,
  existingStatements: string[] = [],
): ExtractionOutcome {
  const durable: DurableCandidate[] = [];
  const discarded: DiscardedCandidate[] = [];

  const haystack = normaliseForQuoteCheck(interactionContent);
  const existing = new Set(existingStatements.map(normaliseStatement));
  const seenThisPass = new Set<string>();

  for (const c of candidates) {
    if (c.confidence < MIN_DURABLE_CONFIDENCE) {
      discarded.push({
        text: c.statement,
        reason: `Low confidence (${c.confidence.toFixed(2)}) — recorded as ambiguous, not enforced as a client rule.`,
      });
      continue;
    }

    if (c.statement.length < MIN_STATEMENT || c.statement.length > MAX_STATEMENT) {
      discarded.push({ text: c.statement, reason: 'Statement was not a usable length.' });
      continue;
    }

    const quote = normaliseForQuoteCheck(c.sourceQuote);
    if (quote.length < 3 || !haystack.includes(quote)) {
      discarded.push({
        text: c.statement,
        reason: 'Could not be traced to a verbatim quote in the feedback, so it was not retained.',
      });
      continue;
    }

    const key = normaliseStatement(c.statement);
    if (seenThisPass.has(key)) {
      discarded.push({ text: c.statement, reason: 'Duplicate of another statement in the same feedback.' });
      continue;
    }
    if (existing.has(key)) {
      discarded.push({
        text: c.statement,
        reason: 'Already remembered for this project — not duplicated.',
      });
      continue;
    }
    seenThisPass.add(key);

    const { scope, needsScopeConfirmation } = resolveScope(c.scopeHint);
    durable.push({
      memoryType: c.type,
      statement: c.statement,
      sourceQuote: c.sourceQuote,
      scope,
      needsScopeConfirmation,
      confidence: c.confidence,
    });
  }

  return { durable, discarded };
}

export interface ExtractInput {
  clientName: string;
  projectName: string;
  interactionLabel: string;
  source: string;
  content: string;
  /** Existing valid statements for this project, used for duplicate suppression. */
  existingStatements?: string[];
}

/** Extract durable memory candidates from raw client feedback. */
export async function extractDurableMemory(input: ExtractInput): Promise<ExtractionOutcome> {
  const result = await completeJSON({
    operation: 'extract',
    system: EXTRACT_SYSTEM,
    user: buildExtractUser(input),
    schema: extractionResultSchema,
    temperature: 0.1,
    maxTokens: 1400,
  });

  const outcome = applyDurabilityGate(result.candidates, input.content, input.existingStatements ?? []);

  // Keep the model's own discard reasoning alongside the gate's.
  outcome.discarded.push(
    ...result.discarded.map((d) => ({ text: d.text, reason: d.reason })),
  );

  logger.info('memory extraction complete', {
    interactionLabel: input.interactionLabel,
    durable: outcome.durable.length,
    discarded: outcome.discarded.length,
  });

  return outcome;
}
