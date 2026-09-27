import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyDurabilityGate, MIN_DURABLE_CONFIDENCE } from '../agents/extract.js';
import type { ExtractionCandidate } from '../llm/schemas.js';

function candidate(over: Partial<ExtractionCandidate> = {}): ExtractionCandidate {
  return {
    type: 'preference',
    statement: 'The client wants shorter headlines.',
    sourceQuote: 'Headlines should be shorter.',
    scopeHint: 'project',
    confidence: 0.9,
    ...over,
  };
}

const FEEDBACK = 'Headlines should be shorter. The animations feel too heavy.';

describe('durability gate', () => {
  test('retains an explicit preference backed by a verbatim quote', () => {
    const out = applyDurabilityGate([candidate()], FEEDBACK);
    assert.equal(out.durable.length, 1);
    assert.equal(out.durable[0]?.memoryType, 'preference');
    assert.equal(out.durable[0]?.scope, 'project');
    assert.equal(out.durable[0]?.needsScopeConfirmation, false);
  });

  test('DROPS a candidate whose quote is not verbatim in the feedback (anti-fabrication)', () => {
    const out = applyDurabilityGate(
      [candidate({ sourceQuote: 'we want a minimalist brand identity' })],
      FEEDBACK,
    );
    assert.equal(out.durable.length, 0, 'fabricated quote must not become memory');
    assert.equal(out.discarded.length, 1);
    assert.match(out.discarded[0]?.reason ?? '', /verbatim/i);
  });

  test('DROPS a low-confidence candidate instead of enforcing it as a client rule', () => {
    const out = applyDurabilityGate(
      [candidate({ confidence: MIN_DURABLE_CONFIDENCE - 0.01 })],
      FEEDBACK,
    );
    assert.equal(out.durable.length, 0);
    assert.match(out.discarded[0]?.reason ?? '', /low confidence/i);
  });

  test('keeps a candidate exactly at the confidence threshold', () => {
    const out = applyDurabilityGate([candidate({ confidence: MIN_DURABLE_CONFIDENCE })], FEEDBACK);
    assert.equal(out.durable.length, 1);
  });

  test('vague feedback yields nothing durable', () => {
    // The model returned no candidates for "make it better" — the gate must not invent one.
    const out = applyDurabilityGate([], 'Make it better. Not quite right.');
    assert.equal(out.durable.length, 0);
  });

  test('tolerates smart quotes and whitespace differences in the quote', () => {
    const feedback = 'The client said: “Headlines   should be shorter.”';
    const out = applyDurabilityGate(
      [candidate({ sourceQuote: '"Headlines should be shorter."' })],
      feedback,
    );
    assert.equal(out.durable.length, 1, 'typographic quote variants must still match');
  });

  test('extracts two distinct signals from one message', () => {
    const out = applyDurabilityGate(
      [
        candidate({ statement: 'The client wants shorter headlines.', sourceQuote: 'Headlines should be shorter.' }),
        candidate({
          type: 'rejection',
          statement: 'The client rejected heavy animation.',
          sourceQuote: 'The animations feel too heavy.',
        }),
      ],
      FEEDBACK,
    );
    assert.equal(out.durable.length, 2);
    assert.deepEqual(
      out.durable.map((d) => d.memoryType).sort(),
      ['preference', 'rejection'],
    );
  });

  test('suppresses a duplicate within the same submission', () => {
    const out = applyDurabilityGate([candidate(), candidate()], FEEDBACK);
    assert.equal(out.durable.length, 1, 'the same statement must not be retained twice');
    assert.match(out.discarded[0]?.reason ?? '', /duplicate/i);
  });

  test('suppresses a statement already remembered for the project', () => {
    const out = applyDurabilityGate([candidate()], FEEDBACK, [
      'The client wants shorter headlines.',
    ]);
    assert.equal(out.durable.length, 0, 'duplicate feedback must not inflate evidence');
    assert.match(out.discarded[0]?.reason ?? '', /already remembered/i);
  });

  test('duplicate suppression ignores punctuation and case', () => {
    const out = applyDurabilityGate([candidate()], FEEDBACK, [
      'the client wants SHORTER headlines',
    ]);
    assert.equal(out.durable.length, 0);
  });

  test('a claimed client-wide scope is held for confirmation, not applied silently', () => {
    const out = applyDurabilityGate([candidate({ scopeHint: 'client' })], FEEDBACK);
    assert.equal(out.durable.length, 1);
    assert.equal(out.durable[0]?.needsScopeConfirmation, true);
    assert.equal(out.durable[0]?.scope, 'project', 'must fall back to the narrow scope');
  });

  test('an unknown scope is held for confirmation', () => {
    const out = applyDurabilityGate([candidate({ scopeHint: 'unknown' })], FEEDBACK);
    assert.equal(out.durable[0]?.needsScopeConfirmation, true);
  });

  test('an explicit one-off stays interaction-scoped without confirmation', () => {
    const out = applyDurabilityGate([candidate({ scopeHint: 'interaction' })], FEEDBACK);
    assert.equal(out.durable[0]?.scope, 'interaction');
    assert.equal(out.durable[0]?.needsScopeConfirmation, false);
  });
});
