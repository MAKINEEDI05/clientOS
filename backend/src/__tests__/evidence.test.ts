import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { bindEvidence, buildWhyLine, humaniseLabel } from '../agents/evidence.js';
import { toEvidenceSnapshot, type RecalledMemory } from '../hindsight/recall.js';
import type { RecommendationOutput } from '../llm/schemas.js';

function memory(id: string, text: string, over: Partial<RecalledMemory> = {}): RecalledMemory {
  return {
    id,
    text,
    factType: 'world',
    memoryType: 'rejection',
    scope: 'project',
    sourceLabel: 'revision-3',
    projectSlug: 'premium-website-redesign',
    tags: ['type:rejection', 'scope:project', 'source:revision-3'],
    context: 'Revision #3',
    occurredAt: '2026-06-12T10:00:00Z',
    mentionedAt: '2026-06-12T10:00:00Z',
    finalScore: 0.8,
    superseded: false,
    ...over,
  };
}

function output(over: Partial<RecommendationOutput> = {}): RecommendationOutput {
  return { summary: 'A direction.', items: [], avoid: [], notes: [], ...over };
}

describe('evidence binding (anti-fabrication gate)', () => {
  const recalled = [
    memory('mem_a', 'The client rejected heavy animation.'),
    memory('mem_b', 'The client approved serif typography.', { memoryType: 'approval' }),
  ];

  test('binds a citation given by stable ref (m1)', () => {
    const res = bindEvidence(
      output({ items: [{ text: 'Use restrained animation', rationale: 'r', evidenceMemoryIds: ['m1'] }] }),
      recalled,
      toEvidenceSnapshot,
    );
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0]?.evidence.length, 1);
    assert.equal(res.items[0]?.evidence[0]?.memoryId, 'mem_a');
  });

  test('binds a citation given by raw Hindsight id', () => {
    const res = bindEvidence(
      output({ items: [{ text: 'Use serif type', rationale: 'r', evidenceMemoryIds: ['mem_b'] }] }),
      recalled,
      toEvidenceSnapshot,
    );
    assert.equal(res.items[0]?.evidence[0]?.memoryId, 'mem_b');
  });

  test('DROPS a hallucinated memory id', () => {
    const res = bindEvidence(
      output({
        items: [
          { text: 'Use a bold palette', rationale: 'the client loves bold colour', evidenceMemoryIds: ['mem_does_not_exist'] },
        ],
      }),
      recalled,
      toEvidenceSnapshot,
    );
    assert.equal(res.droppedCitations, 1, 'unknown id must be dropped');
    assert.equal(res.items.length, 0, 'a history claim with no surviving evidence must be dropped');
  });

  test('DROPS an item that asserts client history but cites nothing', () => {
    const res = bindEvidence(
      output({
        items: [{ text: 'The client prefers minimal design', rationale: '', evidenceMemoryIds: [] }],
      }),
      recalled,
      toEvidenceSnapshot,
    );
    assert.equal(res.items.length, 0);
    assert.equal(res.droppedItems, 1);
  });

  test('KEEPS a general design point that makes no history claim', () => {
    const res = bindEvidence(
      output({
        items: [{ text: 'Use a 12-column responsive grid', rationale: 'Standard practice.', evidenceMemoryIds: [] }],
      }),
      recalled,
      toEvidenceSnapshot,
    );
    assert.equal(res.items.length, 1, 'uncited general advice is allowed');
    assert.equal(res.items[0]?.evidence.length, 0);
  });

  test('deduplicates repeated citations of the same memory', () => {
    const res = bindEvidence(
      output({ items: [{ text: 'Restrained motion', rationale: 'r', evidenceMemoryIds: ['m1', 'mem_a', 'm1'] }] }),
      recalled,
      toEvidenceSnapshot,
    );
    assert.equal(res.items[0]?.evidence.length, 1);
  });

  test('binds avoid items too', () => {
    const res = bindEvidence(
      output({ avoid: [{ text: 'Heavy animation', rationale: 'client rejected it', evidenceMemoryIds: ['m1'] }] }),
      recalled,
      toEvidenceSnapshot,
    );
    assert.equal(res.avoid.length, 1);
    assert.equal(res.avoid[0]?.evidence[0]?.memoryId, 'mem_a');
  });

  test('with zero recalled memories, every history claim is dropped', () => {
    const res = bindEvidence(
      output({ items: [{ text: 'The client approved serif', rationale: '', evidenceMemoryIds: ['m1'] }] }),
      [],
      toEvidenceSnapshot,
    );
    assert.equal(res.items.length, 0);
  });
});

describe('why line', () => {
  test('is assembled from memory text and its source label, not generated', () => {
    const snap = toEvidenceSnapshot(memory('mem_a', 'Heavy animation was rejected.'));
    const why = buildWhyLine([snap]);
    assert.match(why, /Heavy animation was rejected\./);
    assert.match(why, /Revision #3/, 'source label must be rendered for the citation');
  });

  test('states plainly when no history applies', () => {
    assert.match(buildWhyLine([]), /no client history/i);
  });
});

describe('humaniseLabel', () => {
  test('renders slugs the way the demo script cites them', () => {
    assert.equal(humaniseLabel('revision-3'), 'Revision #3');
    assert.equal(humaniseLabel('design-review-1'), 'Design Review #1');
    assert.equal(humaniseLabel('meeting-1'), 'Meeting #1');
  });

  test('handles a slug with no trailing number', () => {
    assert.equal(humaniseLabel('kickoff-call'), 'Kickoff Call');
  });
});
