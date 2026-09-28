import { describe, test, expect, beforeEach } from 'vitest';
import {
  forgetMemoryOff, normaliseRequest, recallMemoryOff, rememberMemoryOff,
} from '../lib/memoryComparison';

const C = 'client-vive';
const P = 'project-web';
const Q = 'Create the next homepage direction.';
const SUMMARY = 'A generic direction with no client history.';

/**
 * A baseline is only meaningful for the exact question it answered, in the
 * workspace it was answered in. Showing an unrelated comparison would be worse
 * than showing none, so these assert the refusals as much as the matches.
 */
describe('memory-off baseline', () => {
  beforeEach(() => sessionStorage.clear());

  test('a stored baseline is recalled for the same client, project and request', () => {
    rememberMemoryOff(C, P, Q, SUMMARY, 'rec_1');
    expect(recallMemoryOff(C, P, Q)?.summary).toBe(SUMMARY);
  });

  test('nothing is recalled when nothing was stored', () => {
    expect(recallMemoryOff(C, P, Q)).toBeNull();
  });

  test('a DIFFERENT CLIENT never sees the baseline', () => {
    rememberMemoryOff(C, P, Q, SUMMARY, 'rec_1');
    expect(recallMemoryOff('client-northwind', P, Q)).toBeNull();
  });

  test('a DIFFERENT PROJECT never sees the baseline', () => {
    rememberMemoryOff(C, P, Q, SUMMARY, 'rec_1');
    expect(recallMemoryOff(C, 'project-mobile', Q)).toBeNull();
  });

  test('a DIFFERENT REQUEST never sees the baseline', () => {
    rememberMemoryOff(C, P, Q, SUMMARY, 'rec_1');
    expect(recallMemoryOff(C, P, 'Draft the tone of voice for the landing page.')).toBeNull();
  });

  test('trivial rewording still matches — case, spacing and trailing punctuation', () => {
    rememberMemoryOff(C, P, Q, SUMMARY, 'rec_1');
    expect(recallMemoryOff(C, P, '  create   the NEXT homepage direction  ')?.summary).toBe(SUMMARY);
  });

  test('normalisation does not reach beyond case, spacing and trailing punctuation', () => {
    expect(normaliseRequest('Create the NEXT  homepage direction?!')).toBe('create the next homepage direction');
    // Genuinely different wording stays different — no similarity matching.
    expect(normaliseRequest('create a homepage direction'))
      .not.toBe(normaliseRequest('create the next homepage direction'));
  });

  test('a later answer to the same request replaces the earlier baseline', () => {
    rememberMemoryOff(C, P, Q, 'first', 'rec_1');
    rememberMemoryOff(C, P, Q, 'second', 'rec_2');
    expect(recallMemoryOff(C, P, Q)?.summary).toBe('second');
  });

  test('a baseline for a new request invalidates the old one rather than coexisting', () => {
    rememberMemoryOff(C, P, Q, SUMMARY, 'rec_1');
    rememberMemoryOff(C, P, 'Something else entirely', 'other', 'rec_2');
    expect(recallMemoryOff(C, P, Q)).toBeNull();
    expect(recallMemoryOff(C, P, 'Something else entirely')?.summary).toBe('other');
  });

  test('an empty summary is not stored — there is nothing to compare', () => {
    rememberMemoryOff(C, P, Q, '', 'rec_1');
    expect(recallMemoryOff(C, P, Q)).toBeNull();
  });

  test('missing identifiers store and recall nothing', () => {
    rememberMemoryOff('', P, Q, SUMMARY, 'rec_1');
    expect(recallMemoryOff('', P, Q)).toBeNull();
    expect(recallMemoryOff(C, '', Q)).toBeNull();
  });

  test('corrupt storage yields no comparison rather than a bad one', () => {
    sessionStorage.setItem(`clientos:memory-off:${C}:${P}`, 'not json');
    expect(recallMemoryOff(C, P, Q)).toBeNull();

    sessionStorage.setItem(`clientos:memory-off:${C}:${P}`, JSON.stringify({ nope: true }));
    expect(recallMemoryOff(C, P, Q)).toBeNull();
  });

  test('a baseline can be discarded', () => {
    rememberMemoryOff(C, P, Q, SUMMARY, 'rec_1');
    forgetMemoryOff(C, P);
    expect(recallMemoryOff(C, P, Q)).toBeNull();
  });

  test('the stored recommendation id is kept, so the baseline is traceable', () => {
    rememberMemoryOff(C, P, Q, SUMMARY, 'rec_abc');
    expect(recallMemoryOff(C, P, Q)?.recommendationId).toBe('rec_abc');
  });
});
