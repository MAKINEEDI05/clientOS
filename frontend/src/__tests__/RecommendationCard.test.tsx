import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecommendationCard } from '../components/RecommendationCard';
import type { RecommendationLine } from '../types/api';

function line(over: Partial<RecommendationLine> = {}): RecommendationLine {
  return {
    id: 'item-1',
    text: 'Use restrained animation',
    rationale: 'Motion should support the content, not compete with it.',
    why: 'The client rejected heavy animation. (Revision #3)',
    evidence: [
      {
        memoryId: 'mem_abc123456789',
        statement: 'The client rejected heavy animation.',
        memoryType: 'rejection',
        scope: 'project',
        sourceLabel: 'revision-3',
        sourceLabelDisplay: 'Revision #3',
        occurredAt: '2026-06-12T10:00:00Z',
        tags: ['type:rejection'],
      },
    ],
    ...over,
  };
}

describe('RecommendationCard', () => {
  test('renders the recommendation text', () => {
    render(<RecommendationCard line={line()} variant="recommend" />);
    expect(screen.getByText('Use restrained animation')).toBeInTheDocument();
  });

  test('hides the Why panel until it is opened', () => {
    render(<RecommendationCard line={line()} variant="recommend" />);
    expect(screen.queryByText('Why this recommendation')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /why\?/i })).toHaveAttribute('aria-expanded', 'false');
  });

  test('reveals the real memory evidence when Why is opened', async () => {
    const user = userEvent.setup();
    render(<RecommendationCard line={line()} variant="recommend" />);

    await user.click(screen.getByRole('button', { name: /why\?/i }));

    expect(screen.getByText('Why this recommendation')).toBeInTheDocument();
    // Appears twice by design: once in the Why sentence, once as the evidence item.
    expect(screen.getAllByText(/The client rejected heavy animation\./)).toHaveLength(2);
    expect(screen.getByText('Supporting memories')).toBeInTheDocument();
    // The source interaction is what makes the claim checkable by a human:
    // once in the Why sentence, once on the evidence card.
    expect(screen.getAllByText(/Revision #3/).length).toBeGreaterThanOrEqual(2);
    // Internal identifiers stay out of the UI — the source citation is the trace.
    expect(screen.queryByText(/mem_abc123456789/)).not.toBeInTheDocument();
  });

  test('shows the number of supporting memories', () => {
    render(<RecommendationCard line={line()} variant="recommend" />);
    expect(screen.getByText('1 memory')).toBeInTheDocument();
  });

  test('labels an uncited point as general practice rather than client history', () => {
    render(<RecommendationCard line={line({ evidence: [] })} variant="recommend" />);
    expect(screen.getByText('General practice')).toBeInTheDocument();
  });

  test('states plainly when no client history applies', async () => {
    const user = userEvent.setup();
    render(
      <RecommendationCard
        line={line({ evidence: [], why: 'General design practice — no client history applies to this point.' })}
        variant="recommend"
      />,
    );
    await user.click(screen.getByRole('button', { name: /why\?/i }));
    // Stated in the Why sentence and again in place of an evidence list.
    expect(screen.getAllByText(/no client history applies/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText(/Revision #3/)).toHaveLength(0);
  });

  test('an avoid item is announced as such to assistive technology', () => {
    render(<RecommendationCard line={line({ text: 'Heavy animation' })} variant="avoid" />);
    expect(screen.getByText('Avoid:')).toBeInTheDocument();
  });

  test('the Why toggle is keyboard reachable and operable', async () => {
    const user = userEvent.setup();
    render(<RecommendationCard line={line()} variant="recommend" />);
    await user.tab();
    const button = screen.getByRole('button', { name: /why\?/i });
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
