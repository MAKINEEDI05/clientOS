import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryUsedBanner } from '../components/MemoryUsedBanner';
import type { Recommendation } from '../types/api';

function rec(over: Partial<Recommendation> = {}): Recommendation {
  return {
    recommendationId: 'r1', memoryUsed: true, memoryCount: 7, hindsightOk: true,
    summary: 'A direction.', items: [], avoid: [], notes: [], caveats: [],
    model: 'llama-3.3-70b-versatile', latencyMs: 900, ...over,
  };
}

describe('MemoryUsedBanner', () => {
  test('states how many memories grounded the answer', () => {
    render(<MemoryUsedBanner recommendation={rec()} />);
    expect(screen.getByText(/Grounded in 7 recalled memories/i)).toBeInTheDocument();
  });

  test('uses the singular for one memory', () => {
    render(<MemoryUsedBanner recommendation={rec({ memoryCount: 1 })} />);
    expect(screen.getByText(/Grounded in 1 recalled memory/i)).toBeInTheDocument();
  });

  test('says plainly when NO history was used, and never implies otherwise', () => {
    render(<MemoryUsedBanner recommendation={rec({ memoryUsed: false, memoryCount: 0 })} />);
    expect(screen.getByText(/No client history was used/i)).toBeInTheDocument();
    expect(screen.getByText(/this direction is generic/i)).toBeInTheDocument();
    expect(screen.queryByText(/Grounded in/i)).not.toBeInTheDocument();
  });
});
