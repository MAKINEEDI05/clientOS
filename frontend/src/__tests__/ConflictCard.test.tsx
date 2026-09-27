import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConflictCard } from '../components/ConflictCard';
import type { Conflict } from '../types/api';

function conflict(over: Partial<Conflict> = {}): Conflict {
  return {
    id: 'c1',
    status: 'pending',
    newStatement: 'The client is now open to brighter accent colours.',
    newMemoryType: 'preference_change',
    oldStatement: 'The client wants to avoid bright, saturated colours.',
    oldMemoryId: 'mem_old',
    oldMemoryRefId: 'ref_old',
    explanation: 'The client has reversed an earlier restriction on bright colour.',
    interactionLabel: 'Revision #6',
    resolvedScope: null,
    resolution: null,
    createdAt: '2026-09-26T10:00:00Z',
    resolvedAt: null,
    ...over,
  };
}

describe('ConflictCard', () => {
  test('shows BOTH the old and the new statement', () => {
    render(<ConflictCard conflict={conflict()} onResolve={vi.fn()} pending={false} error={null} />);
    expect(screen.getByText(/avoid bright, saturated colours/i)).toBeInTheDocument();
    expect(screen.getByText(/open to brighter accent colours/i)).toBeInTheDocument();
  });

  test('offers all three scopes, including a temporary exception', () => {
    render(<ConflictCard conflict={conflict()} onResolve={vi.fn()} pending={false} error={null} />);
    expect(screen.getByRole('radio', { name: /temporary exception/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /this project/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /all future projects/i })).toBeInTheDocument();
  });

  test('preselects NO scope, so the user must decide', () => {
    render(<ConflictCard conflict={conflict()} onResolve={vi.fn()} pending={false} error={null} />);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
  });

  test('Confirm is disabled until a scope is chosen', async () => {
    const user = userEvent.setup();
    render(<ConflictCard conflict={conflict()} onResolve={vi.fn()} pending={false} error={null} />);

    const confirm = screen.getByRole('button', { name: /confirm change/i });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /this project/i }));
    expect(confirm).toBeEnabled();
  });

  test('passes the chosen scope to the resolver', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<ConflictCard conflict={conflict()} onResolve={onResolve} pending={false} error={null} />);

    await user.click(screen.getByRole('radio', { name: /this project/i }));
    await user.click(screen.getByRole('button', { name: /confirm change/i }));

    expect(onResolve).toHaveBeenCalledWith('new_preference', 'project');
  });

  test('keeping the existing preference needs no scope', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<ConflictCard conflict={conflict()} onResolve={onResolve} pending={false} error={null} />);

    await user.click(screen.getByRole('button', { name: /keep existing/i }));
    expect(onResolve).toHaveBeenCalledWith('keep_existing');
  });

  test('promises that history is preserved either way', () => {
    render(<ConflictCard conflict={conflict()} onResolve={vi.fn()} pending={false} error={null} />);
    expect(screen.getByText(/Nothing is deleted/i)).toBeInTheDocument();
  });

  test('disables every control while a resolution is in flight', () => {
    render(<ConflictCard conflict={conflict()} onResolve={vi.fn()} pending error={null} />);
    expect(screen.getByRole('button', { name: /confirm change/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /keep existing/i })).toBeDisabled();
  });

  test('renders a resolution error', () => {
    render(<ConflictCard conflict={conflict()} onResolve={vi.fn()} pending={false} error="Already resolved." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Already resolved.');
  });

  test('a scope-only confirmation omits the struck-through old statement block', () => {
    render(
      <ConflictCard
        conflict={conflict({ oldMemoryId: null, oldStatement: '(no existing preference — scope confirmation required)' })}
        onResolve={vi.fn()} pending={false} error={null}
      />,
    );
    expect(screen.getByText(/Scope confirmation needed/i)).toBeInTheDocument();
    expect(screen.queryByText('Previously remembered')).not.toBeInTheDocument();
  });
});
