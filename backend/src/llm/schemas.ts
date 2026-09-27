import { z } from 'zod';
import { MEMORY_TYPES } from '../types/domain.js';

/**
 * Schemas that validate LLM output. Anything failing these is rejected — the
 * model never gets to hand us arbitrary data.
 */

/** One candidate durable memory extracted from client feedback. */
export const extractionCandidateSchema = z.object({
  type: z.enum(MEMORY_TYPES),
  /** Self-contained third-person statement. */
  statement: z.string().trim().min(10).max(300),
  /** Must be a verbatim span of the input — verified in code, not trusted. */
  sourceQuote: z.string().trim().min(3).max(1000),
  scopeHint: z.enum(['interaction', 'revision', 'project', 'client', 'unknown']),
  confidence: z.number().min(0).max(1),
});

export const extractionResultSchema = z.object({
  candidates: z.array(extractionCandidateSchema).max(10),
  discarded: z
    .array(
      z.object({
        text: z.string().trim().max(500),
        reason: z.string().trim().max(300),
      }),
    )
    .max(10)
    .default([]),
});

export type ExtractionCandidate = z.infer<typeof extractionCandidateSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/** Verdict on whether a new statement contradicts an existing memory. */
export const conflictVerdictSchema = z.object({
  conflicts: z.boolean(),
  /** Must be one of the memory ids we supplied — verified in code. */
  oldMemoryId: z.string().trim().nullable(),
  explanation: z.string().trim().max(400),
  confidence: z.number().min(0).max(1),
});

export type ConflictVerdict = z.infer<typeof conflictVerdictSchema>;

/** Structured recommendation. `evidenceMemoryIds` are validated against recall. */
export const recommendationOutputSchema = z.object({
  summary: z.string().trim().min(10).max(800),
  items: z
    .array(
      z.object({
        text: z.string().trim().min(3).max(300),
        rationale: z.string().trim().max(400).default(''),
        evidenceMemoryIds: z.array(z.string().trim()).max(10).default([]),
      }),
    )
    .max(12)
    .default([]),
  avoid: z
    .array(
      z.object({
        text: z.string().trim().min(3).max(300),
        rationale: z.string().trim().max(400).default(''),
        evidenceMemoryIds: z.array(z.string().trim()).max(10).default([]),
      }),
    )
    .max(12)
    .default([]),
  notes: z.array(z.string().trim().max(300)).max(6).default([]),
});

export type RecommendationOutput = z.infer<typeof recommendationOutputSchema>;
