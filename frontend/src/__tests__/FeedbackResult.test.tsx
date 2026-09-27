import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackResult } from '../components/FeedbackResult';
import type { SubmitInteractionResult } from '../types/api';

function result(over: Partial<SubmitInteractionResult> = {}): SubmitInteractionResult {
  return {
    interaction: {
      id: 'i1', label: 'Design Review #1', source: 'design-review',
      content: 'Keep the colour palette restrained and avoid bright saturated colours.',
      occurredAt: '2026-06-15T10:00:00Z', retainStatus: 'retained',
    },
    extracted: [{
      memoryType: 'preference',
      statement: 'The client prefers a restrained colour palette.',
      scope: 'project', confidence: 0.95,
      sourceQuote: 'Keep the colour palette restrained', retained: true,
      needsScopeConfirmation: false,
    }],
    discarded: [], retained: 1, conflicts: [], warnings: [],
    ...over,
  };
}

function renderResult(r: SubmitInteractionResult) {
  return render(
    <MemoryRouter>
      <FeedbackResult result={r} memoryHref="/clients/x/memory" onDismiss={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('FeedbackResult', () => {
  test('shows the raw client statement alongside what was understood', () => {
    renderResult(result());
    expect(screen.getByText(/Keep the colour palette restrained and avoid/)).toBeInTheDocument();
    expect(screen.getByText('ClientOS understood')).toBeInTheDocument();
    expect(screen.getByText('The client prefers a restrained colour palette.')).toBeInTheDocument();
  });

  test('shows the memory type and scope in product language', () => {
    renderResult(result());
    expect(screen.getByText('Preference')).toBeInTheDocument();
    expect(screen.getByText('This project')).toBeInTheDocument();
    expect(screen.getByText(/Stored in client memory/)).toBeInTheDocument();
  });

  test('names the source interaction so the memory is traceable', () => {
    renderResult(result());
    expect(screen.getAllByText('Design Review #1').length).toBeGreaterThan(0);
  });

  test('states plainly when nothing durable was found, and does NOT claim memory', () => {
    renderResult(result({
      extracted: [], retained: 0,
      discarded: [{ text: 'Make it better.', reason: 'vague statement with no usable content' }],
      interaction: { ...result().interaction, retainStatus: 'not_durable' },
    }));

    expect(screen.getByText(/No durable client preference was detected/i)).toBeInTheDocument();
    expect(screen.queryByText(/Stored in client memory/)).not.toBeInTheDocument();
    expect(screen.getByText(/kept as an interaction/i)).toBeInTheDocument();
  });

  test('shows discards with their reasons, so selectivity is visible', () => {
    renderResult(result({
      discarded: [{ text: 'Thanks!', reason: 'greeting/pleasantries' }],
    }));
    expect(screen.getByText(/Not stored \(1\)/)).toBeInTheDocument();
  });

  test('a held candidate is NOT presented as stored', () => {
    renderResult(result({
      retained: 0,
      extracted: [{
        memoryType: 'preference_change',
        statement: 'The client is now open to brighter accent colours.',
        scope: 'project', confidence: 0.95, sourceQuote: 'now open', retained: false,
        needsScopeConfirmation: false,
      }],
      conflicts: [{
        id: 'c1', status: 'pending', newStatement: 'n', newMemoryType: 'preference_change',
        oldStatement: 'o', oldMemoryId: 'm', oldMemoryRefId: 'r', explanation: 'e',
        interactionLabel: 'Revision #6', resolvedScope: null, resolution: null,
        createdAt: '2026-09-26T10:00:00Z', resolvedAt: null,
      }],
    }));

    expect(screen.queryByText(/Stored in client memory/)).not.toBeInTheDocument();
    expect(screen.getByText(/Held —/)).toBeInTheDocument();
    expect(screen.getByText(/changes an existing preference/i)).toBeInTheDocument();
  });
});
