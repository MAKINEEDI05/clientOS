import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientEvidence, collectEvidence } from '../components/ClientEvidence';
import type { EvidenceItem, Recommendation, RecommendationLine } from '../types/api';

function ev(id: string, over: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    memoryId: id,
    statement: `Memory ${id}`,
    memoryType: 'rejection',
    scope: 'project',
    sourceLabel: 'revision-3',
    sourceLabelDisplay: 'Revision #3',
    occurredAt: '2026-06-12T10:00:00Z',
    tags: [],
    ...over,
  };
}

function line(id: string, evidence: EvidenceItem[]): RecommendationLine {
  return { id, text: `Point ${id}`, rationale: 'r', why: 'w', evidence };
}

function rec(over: Partial<Recommendation> = {}): Recommendation {
  return {
    recommendationId: 'r1', memoryUsed: true, memoryCount: 9, hindsightOk: true,
    summary: 'A direction.', items: [], avoid: [], notes: [], caveats: [],
    model: 'openai/gpt-oss-120b', latencyMs: 900, ...over,
  };
}

describe('collectEvidence', () => {
  test('gathers evidence from both items and avoid', () => {
    const out = collectEvidence(rec({
      items: [line('a', [ev('m1')])],
      avoid: [line('b', [ev('m2')])],
    }));
    expect(out.map((e) => e.memoryId)).toEqual(['m1', 'm2']);
  });

  test('de-duplicates a memory cited by several points', () => {
    const out = collectEvidence(rec({
      items: [line('a', [ev('m1')]), line('b', [ev('m1'), ev('m2')])],
      avoid: [line('c', [ev('m2')])],
    }));
    // The same memory backing three points is still one piece of evidence.
    expect(out.map((e) => e.memoryId)).toEqual(['m1', 'm2']);
  });

  test('returns nothing when no point cited a memory', () => {
    expect(collectEvidence(rec({ items: [line('a', [])] }))).toEqual([]);
  });
});

describe('ClientEvidence', () => {
  test('reports the real count of memories that informed the recommendation', () => {
    render(<ClientEvidence recommendation={rec({
      items: [line('a', [ev('m1'), ev('m2')])],
      avoid: [line('b', [ev('m3')])],
    })} />);
    expect(screen.getByText('3 client memories informed this recommendation')).toBeInTheDocument();
  });

  test('uses the singular for one memory', () => {
    render(<ClientEvidence recommendation={rec({ items: [line('a', [ev('m1')])] })} />);
    expect(screen.getByText('1 client memory informed this recommendation')).toBeInTheDocument();
  });

  test('the count reflects CITED evidence, not the number recalled', () => {
    // 9 memories were recalled into context; only 2 actually backed the answer.
    render(<ClientEvidence recommendation={rec({
      memoryCount: 9, items: [line('a', [ev('m1'), ev('m2')])],
    })} />);
    expect(screen.getByText('2 client memories informed this recommendation')).toBeInTheDocument();
    expect(screen.queryByText(/9 client memories informed/)).not.toBeInTheDocument();
  });

  test('renders each memory with its type, scope and source interaction', () => {
    render(<ClientEvidence recommendation={rec({
      items: [line('a', [ev('m1', { statement: 'The client rejected heavy animation.' })])],
    })} />);
    expect(screen.getByText('Rejection')).toBeInTheDocument();
    expect(screen.getByText('This project')).toBeInTheDocument();
    expect(screen.getByText('The client rejected heavy animation.')).toBeInTheDocument();
    expect(screen.getByText(/Revision #3/)).toBeInTheDocument();
  });

  test('with memory OFF it reports zero and explains why', () => {
    render(<ClientEvidence recommendation={rec({ memoryUsed: false, memoryCount: 0 })} />);
    expect(screen.getByText('0 client memories informed this recommendation')).toBeInTheDocument();
    expect(screen.getByText(/Client memory was switched off/i)).toBeInTheDocument();
    // It must not imply history was consulted.
    expect(screen.queryByText(/No specific client memory backed/i)).not.toBeInTheDocument();
  });

  test('with memory ON but nothing cited, it says so without inventing evidence', () => {
    render(<ClientEvidence recommendation={rec({ memoryUsed: true, items: [line('a', [])] })} />);
    expect(screen.getByText('0 client memories informed this recommendation')).toBeInTheDocument();
    expect(screen.getByText(/No specific client memory backed this direction/i)).toBeInTheDocument();
  });

  test('never renders internal identifiers', () => {
    // Statement deliberately does not contain the id, so any occurrence in the
    // output would mean the component surfaced the raw identifier itself.
    const { container } = render(<ClientEvidence recommendation={rec({
      items: [line('a', [ev('mem_abc123456789', { statement: 'The client prefers muted tones.' })])],
    })} />);
    expect(screen.getByText('The client prefers muted tones.')).toBeInTheDocument();
    expect(container.textContent).not.toContain('mem_abc123456789');
  });
});
