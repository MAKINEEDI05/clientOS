import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { __redactForTest } from '../utils/logger.js';
import { AppError, ErrorCode } from '../utils/errors.js';

describe('log redaction', () => {
  test('redacts secret-named fields', () => {
    const out = __redactForTest({
      apiKey: 'hsk_realsecret',
      HINDSIGHT_API_KEY: 'hsk_realsecret',
      GROQ_API_KEY: 'gsk_realsecret',
      DATABASE_URL: 'postgres://u:p@h/db',
      authorization: 'Bearer hsk_realsecret',
      password: 'hunter2',
      demo_reset_token: 'tok',
    }) as Record<string, unknown>;

    for (const [key, value] of Object.entries(out)) {
      assert.equal(value, '[redacted]', `${key} must be redacted`);
    }
  });

  test('redacts key-shaped strings even under an innocent field name', () => {
    const out = __redactForTest({ note: 'hsk_abc123', other: 'gsk_abc123', third: 'sk-abc123' }) as Record<string, unknown>;
    assert.equal(out.note, '[redacted]');
    assert.equal(out.other, '[redacted]');
    assert.equal(out.third, '[redacted]');
  });

  test('redacts nested secrets', () => {
    const out = __redactForTest({ config: { nested: { apiKey: 'hsk_x' } } }) as { config: { nested: { apiKey: string } } };
    assert.equal(out.config.nested.apiKey, '[redacted]');
  });

  test('truncates very long strings so logs stay bounded', () => {
    const out = __redactForTest({ text: 'x'.repeat(5000) }) as { text: string };
    assert.ok(out.text.length < 400, 'long values must be truncated');
    assert.match(out.text, /5000 chars/);
  });

  test('keeps ordinary diagnostic values intact', () => {
    const out = __redactForTest({ clientId: 'vive-studio', count: 7, ok: true }) as Record<string, unknown>;
    assert.equal(out.clientId, 'vive-studio');
    assert.equal(out.count, 7);
    assert.equal(out.ok, true);
  });

  test('reduces an Error to name and message, never a stack', () => {
    const out = __redactForTest({ err: new Error('boom') }) as { err: Record<string, unknown> };
    assert.deepEqual(out.err, { name: 'Error', message: 'boom' });
    assert.ok(!('stack' in out.err));
  });
});

describe('error messages', () => {
  test('a memory failure never implies history was used', () => {
    const e = AppError.memoryUnavailable('credentials rejected');
    assert.equal(e.status, 503);
    assert.equal(e.code, ErrorCode.MEMORY_UNAVAILABLE);
    assert.match(e.message, /could not safely use client history/i);
  });

  test('an LLM failure is distinguishable from a memory failure', () => {
    const llm = AppError.llmUnavailable('timeout');
    assert.equal(llm.code, ErrorCode.LLM_UNAVAILABLE);
    assert.notEqual(llm.code, ErrorCode.MEMORY_UNAVAILABLE);
    assert.match(llm.message, /recommendation could not be generated/i);
  });

  test('internal errors expose no detail to the caller', () => {
    const e = AppError.internal('database constraint xyz failed on table users');
    // Callers get a generic message; the specific text stays in logs only.
    assert.equal(e.status, 500);
    assert.equal(e.details, undefined);
  });

  test('validation errors carry safe field-level details', () => {
    const e = AppError.validation('bad', [{ field: 'message', message: 'Required' }]);
    assert.equal(e.status, 400);
    assert.deepEqual(e.details, [{ field: 'message', message: 'Required' }]);
  });
});
