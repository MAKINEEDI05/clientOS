import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConflictResolved } from '../components/ConflictResolved';
import { RecommendationChange } from '../components/RecommendationChange';
import type { ResolveConflictResult } from '../types/api';

function resolution(over: Partial<ResolveConflictResult> = {}): ResolveConflictResult {
  return {
    conflictId: 'c1',
    status: 'resolved',
    resolvedScope: 'project',
    newMemory: {
      memoryRefId: 'r-new',
      hindsightMemoryId: 'm-new',
      statement: 'The client is now open to brighter accent colours.',
      scope: 'project',
    },
    supersededMemory: {
      memoryRefId: 'r-old',
      statement: 'The client wants to avoid bright, saturated colours.',
      state: 'superseded',
    },
    directive: { id: 'd1', scope: 'project' },
    warnings: [],
    ...over,
  };
}

function renderResolved(r: ResolveConflictResult, projectName = 'Premium Website Redesign') {
  return render(
    <MemoryRouter>
      <ConflictResolved resolution={r} memoryHref="/clients/x/memory" projectName={projectName} />
    </MemoryRouter>,
  );
}

describe('ConflictResolved', () => {
  test('reports a meaningful outcome, not just success', () => {
    renderResolved(resolution());
    expect(screen.getByText('Preference updated')).toBeInTheDocument();
    expect(screen.queryByText(/^success$/i)).not.toBeInTheDocument();
  });

  test('shows the new preference, its reach, and the previous preference', () => {
    renderResolved(resolution());
    expect(screen.getByText('The client is now open to brighter accent colours.')).toBeInTheDocument();
    expect(screen.getByText('The client wants to avoid bright, saturated colours.')).toBeInTheDocument();
    // Reach is stated in plain language, naming the project it was confirmed on.
    expect(screen.getByText(/This project — Premium Website Redesign only\./))
      .toBeInTheDocument();
  });

  test('a project-scoped change does not read as client-wide', () => {
    const { container } = renderResolved(resolution());
    expect(container.textContent).not.toMatch(/all of this client's future work/i);
  });

  test('states that the previous preference is preserved, not deleted', () => {
    renderResolved(resolution());
    expect(screen.getByText('Superseded — preserved in history')).toBeInTheDocument();
  });

  test('reports a client-wide change as retired but preserved', () => {
    renderResolved(resolution({
      resolvedScope: 'future',
      supersededMemory: { memoryRefId: 'r-old', statement: 'Old.', state: 'invalidated' },
    }));
    expect(screen.getByText('Retired from active use — preserved in history')).toBeInTheDocument();
    expect(screen.getByText(/All future projects — all of this client's future work\./))
      .toBeInTheDocument();
  });

  test('states plainly that nothing was deleted', () => {
    renderResolved(resolution());
    expect(screen.getByText(/Nothing was deleted\./)).toBeInTheDocument();
    expect(screen.getByText(/Both decisions remain on this client's memory timeline/))
      .toBeInTheDocument();
  });

  test('a failed retirement is reported honestly, not glossed as success', () => {
    renderResolved(resolution({
      resolvedScope: 'future',
      supersededMemory: { memoryRefId: 'r-old', statement: 'Old.', state: 'valid' },
      warnings: ['The previous preference could not be retired in the memory service.'],
    }));
    expect(screen.getByText(/Still in force — retirement did not complete/)).toBeInTheDocument();
    expect(screen.getByText(/could not be retired in the memory service/)).toBeInTheDocument();
  });

  test('links to the memory timeline where both decisions live', () => {
    renderResolved(resolution());
    expect(screen.getByRole('link', { name: /memory timeline/i })).toHaveAttribute(
      'href', '/clients/x/memory',
    );
  });

  test('keeping the previous preference reports that nothing was stored', () => {
    renderResolved(resolution({ newMemory: null, supersededMemory: null, resolvedScope: null }));
    expect(screen.getByText('Preference kept')).toBeInTheDocument();
    expect(screen.getByText(/Nothing was added to this client's memory/i)).toBeInTheDocument();
    expect(screen.queryByText('Preference updated')).not.toBeInTheDocument();
    // It names where the earlier preference stays in force.
    expect(screen.getByText(/stays in force on Premium Website Redesign/)).toBeInTheDocument();
  });

  test('surfaces warnings returned by the backend', () => {
    renderResolved(resolution({ warnings: ['The hard rule could not be registered.'] }));
    expect(screen.getByText('The hard rule could not be registered.')).toBeInTheDocument();
  });
});

describe('RecommendationChange', () => {
  const BEFORE = 'Design a premium homepage using a muted palette throughout.';
  const AFTER = 'Design a premium homepage with a muted base palette and brighter accents.';

  test('shows the real previous direction and offers to regenerate', () => {
    render(
      <RecommendationChange before={BEFORE} after={null} onRegenerate={vi.fn()} regenerating={false} />,
    );
    expect(screen.getByText('Recommendation updated')).toBeInTheDocument();
    expect(screen.getByText(BEFORE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate updated direction/i })).toBeInTheDocument();
  });

  test('does not regenerate on its own — the user asks for it', async () => {
    const onRegenerate = vi.fn();
    render(
      <RecommendationChange before={BEFORE} after={null} onRegenerate={onRegenerate} regenerating={false} />,
    );
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  test('shows before and after once the new direction exists', () => {
    render(
      <RecommendationChange before={BEFORE} after={AFTER} onRegenerate={vi.fn()} regenerating={false} />,
    );
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText(BEFORE)).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    expect(screen.getByText(AFTER)).toBeInTheDocument();
    // Once regenerated there is nothing left to ask for.
    expect(screen.queryByRole('button', { name: /generate updated direction/i })).not.toBeInTheDocument();
  });

  test('both sides are real output — the component invents no wording', () => {
    const { container } = render(
      <RecommendationChange before={BEFORE} after={AFTER} onRegenerate={vi.fn()} regenerating={false} />,
    );
    // Nothing scenario-specific is baked in.
    expect(container.textContent).not.toMatch(/brighter accents for highlights/i);
  });
});
