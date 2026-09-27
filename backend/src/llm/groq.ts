import Groq from 'groq-sdk';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * THE single Groq client for ClientOS. Every LLM call in the system goes through
 * completeJSON() below. There is no second LLM integration anywhere.
 */

let singleton: Groq | null = null;

function getGroq(): Groq {
  if (!env.groqConfigured) {
    throw AppError.llmUnavailable('GROQ_API_KEY is not configured');
  }
  if (!singleton) {
    singleton = new Groq({ apiKey: env.GROQ_API_KEY, maxRetries: 1 });
  }
  return singleton;
}

export const LLM_MODEL = env.GROQ_MODEL;

const DEFAULT_TIMEOUT_MS = 30_000;

/** Strip markdown fences some models wrap JSON in, then isolate the JSON object. */
function extractJson(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence?.[1]) s = fence[1].trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  return s;
}

export interface CompleteJsonArgs<S extends z.ZodTypeAny> {
  system: string;
  user: string;
  /** Generic over the schema itself, so the return type is the PARSED output
   *  (with zod defaults applied) rather than the raw input shape. */
  schema: S;
  /** Label used in logs and error context. */
  operation: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Structured JSON completion with validation.
 *
 * LLM output is never trusted: the raw text is parsed, then validated against a
 * zod schema. One repair attempt is made (feeding the validation error back);
 * after that the caller receives a controlled LLM_UNAVAILABLE error rather than
 * unvalidated data.
 */
export async function completeJSON<S extends z.ZodTypeAny>(
  args: CompleteJsonArgs<S>,
): Promise<z.infer<S>> {
  const {
    system,
    user,
    schema,
    operation,
    temperature = 0.2,
    maxTokens = 2048,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = args;

  const client = getGroq();
  const started = Date.now();

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  let lastFailure = '';

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let text: string;
    try {
      const completion = await client.chat.completions.create(
        {
          model: LLM_MODEL,
          messages,
          temperature: attempt === 1 ? temperature : Math.min(1, temperature + 0.2),
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        },
        { timeout: timeoutMs },
      );
      text = completion.choices[0]?.message?.content ?? '';
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const status = (e as { status?: number }).status;

      // Configuration and auth faults are terminal — retrying cannot help.
      if (status === 401 || status === 403) {
        logger.error('groq request failed', { operation, attempt, status });
        throw AppError.llmUnavailable('AI provider rejected our credentials', { operation });
      }
      if (status === 404 || /does not exist|do not have access/i.test(message)) {
        logger.error('groq model unavailable', { operation, model: LLM_MODEL });
        throw AppError.llmUnavailable(
          `the configured model "${LLM_MODEL}" is not available on this account`,
          { operation },
        );
      }

      // The provider's own JSON-mode validator rejected the generation. That is a
      // bad completion, not an outage, so it is retried like any malformed output.
      const jsonValidateFailed =
        status === 400 && /json_validate_failed|Failed to validate JSON/i.test(message);

      const retryable = jsonValidateFailed || status === 429 || (status ?? 0) >= 500;

      if (retryable && attempt < MAX_ATTEMPTS) {
        logger.warn('groq call failed, retrying', {
          operation, attempt, status,
          reason: jsonValidateFailed ? 'provider rejected its own JSON' : 'transient',
        });
        lastFailure = jsonValidateFailed
          ? 'the provider rejected the generated JSON'
          : `provider error ${status ?? 'unknown'}`;
        // Back off briefly before trying again.
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }

      logger.error('groq request failed', { operation, attempt, status, error: message });

      if (status === 429) {
        throw AppError.llmUnavailable('AI provider is rate limited', { operation });
      }
      if (jsonValidateFailed) {
        throw AppError.llmUnavailable('AI returned an unusable response', { operation });
      }
      if (/timeout|aborted/i.test(message)) {
        throw AppError.llmUnavailable('AI provider timed out', { operation });
      }
      throw AppError.llmUnavailable('AI provider could not be reached', { operation });
    }

    if (!text.trim()) {
      lastFailure = 'empty response';
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(text));
      } catch {
        lastFailure = 'response was not valid JSON';
        logger.warn('groq returned non-JSON', { operation, attempt, preview: text.slice(0, 200) });
        parsed = undefined;
      }

      if (parsed !== undefined) {
        const validated = schema.safeParse(parsed);
        if (validated.success) {
          logger.info('groq completion ok', {
            operation,
            attempt,
            model: LLM_MODEL,
            latencyMs: Date.now() - started,
          });
          return validated.data;
        }
        lastFailure = validated.error.issues
          .slice(0, 6)
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; ');
        logger.warn('groq output failed schema validation', { operation, attempt, issues: lastFailure });
      }
    }

    if (attempt < MAX_ATTEMPTS) {
      // Feed back exactly what was wrong so the next attempt can correct it.
      messages.push({ role: 'assistant', content: text.slice(0, 4000) });
      messages.push({
        role: 'user',
        content:
          `That response was rejected: ${lastFailure}. ` +
          'Reply again with ONLY a single valid JSON object matching the required shape. No prose, no markdown fences.',
      });
    }
  }

  throw AppError.llmUnavailable('AI returned an unusable response', { operation, detail: lastFailure });
}

/** Reset the cached client. Test-only. */
export function __resetGroqClient(): void {
  singleton = null;
}
