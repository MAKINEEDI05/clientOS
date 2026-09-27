import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConflictCard, findOldMemory } from '../components/ConflictCard';
import type { Conflict, MemoryItem } from '../types/api';

function conflict(over: Partial<Conflict> = {}): Conflict {
  return {
    id: 'c1',
    status: 'pending',
    newStatement: 'The client is now open to brighter accent colours.',
    newMemoryType: 'preference_change',
    oldStatement: 'The client wants to avoid bright, saturated colours.',
    oldMemoryId: 'mem_old',
    oldMemoryRefId: 'ref_old',
    explanation: 'The new feedback conflicts with an existing client preference for this scope.',
    interactionLabel: 'Revision #6',
    resolvedScope: null,
    resolution: null,
    createdAt: '2026-09-26T10:00:00Z',
    resolvedAt: null,
    ...over,
  };
}

function memory(over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: 'ref_old',
    hindsightMemoryId: 'mem_old',
    memoryType: 'rejection',
    statement: 'The client wants to avoid bright, saturated colours.',
    scope: 'project',
    state: 'valid',
    tags: [],
    confidence: 0.95,
    sourceQuote: 'avoid bright, saturated colours',
    occurredAt: '2026-06-15T10:00:00Z',
    interaction: { id: 'i1', label: 'Design Review #1', labelDisplay: 'Design Review #1', source: 'design-review' },
    sourceLabelDisplay: 'Design Review #1',
    supersedes: [],
    supersededBy: null,
    ...over,
  };
}

const base = {
  onResolve: vi.fn(),
  pending: false,
  error: null,
};

describe('findOldMemory', () => {
  test('matches the previous decision by its memory reference', () => {
    const found = findOldMemory(conflict(), [memory({ id: 'other' }), memory()]);
    expect(found?.sourceLabelDisplay).toBe('Design Review #1');
  });

  test('returns null when the conflict has no local record of the old memory', () => {
    // Happens when a conflict is raised against a consolidated memory.
    expect(findOldMemory(conflict({ oldMemoryRefId: null }), [memory()])).toBeNull();
    expect(findOldMemory(conflict(), undefined)).toBeNull();
  });
});

describe('ConflictCard — presentation', () => {
  test('is framed as a client preference change, not an error', () => {
    render(<ConflictCard conflict={conflict()} {...base} />);
    expect(screen.getByText('Client preference changed')).toBeInTheDocument();
    expect(screen.queryByText(/error|warning|failed/i)).not.toBeInTheDocument();
  });

  test('renders the previous decision', () => {
    render(<ConflictCard conflict={conflict()} {...base} />);
    expect(screen.getByText('Previous decision')).toBeInTheDocument();
    expect(screen.getByText(/avoid bright, saturated colours/i)).toBeInTheDocument();
  });

  test('renders the new decision with its source interaction', () => {
    render(<ConflictCard conflict={conflict()} {...base} />);
    expect(screen.getByText('New decision')).toBeInTheDocument();
    expect(screen.getByText(/open to brighter accent colours/i)).toBeInTheDocument();
    expect(screen.getByText('Revision #6')).toBeInTheDocument();
  });

  test('shows the previous decision’s source and scope when we hold a record of it', () => {
    render(<ConflictCard conflict={conflict()} oldMemory={memory()} {...base} />);
    // Scoped to the previous-decision block: "This project" is also a scope option label.
    const block = screen.getByText('Previous decision').closest('div');
    expect(block).not.toBeNull();
    expect(block!.textContent).toContain('Design Review #1');
    expect(block!.textContent).toContain('This project');
  });

  test('omits provenance rather than inventing it when no record exists', () => {
    render(<ConflictCard conflict={conflict()} oldMemory={null} {...base} />);
    expect(screen.getByText(/avoid bright, saturated colours/i)).toBeInTheDocument();
    expect(screen.queryByText('Design Review #1')).not.toBeInTheDocument();
  });

  test('explains why it was flagged, using the returned explanation', () => {
    render(<ConflictCard conflict={conflict()} {...base} />);
    expect(screen.getByText('Why ClientOS flagged this')).toBeInTheDocument();
    expect(screen.getByText(/conflicts with an existing client preference/i)).toBeInTheDocument();
  });

  test('never exposes internal identifiers or memory-layer vocabulary', () => {
    const { container } = render(<ConflictCard conflict={conflict()} oldMemory={memory()} {...base} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/any_strict|tag group|bank|hindsight/i);
    expect(text).not.toContain('mem_old');
    expect(text).not.toContain('ref_old');
  });

  test('states that previous decisions are preserved', () => {
    render(<ConflictCard conflict={conflict()} {...base} />);
    expect(screen.getByText(/remain in history even when a newer decision supersedes/i)).toBeInTheDocument();
  });
});

describe('ConflictCard — scope selection', () => {
  test('offers all three scopes', () => {
    render(<ConflictCard conflict={conflict()} {...base} />);
    expect(screen.getByRole('radio', { name: /this interaction/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /this project/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /all future projects/i })).toBeInTheDocument();
  });

  test('preselects NO scope, so the user must decide', () => {
    render(<ConflictCard conflict={conflict()} {...base} />);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
  });

  test('exposes the options as a labelled radiogroup', () => {
    render(<ConflictCard conflict={conflict()} {...base} />);
    expect(screen.getByRole('radiogroup', { name: /how should this change apply/i })).toBeInTheDocument();
  });

  test('the chosen option becomes checked', async () => {
    const user = userEvent.setup();
    render(<ConflictCard conflict={conflict()} {...base} />);
    const option = screen.getByRole('radio', { name: /this project/i });
    await user.click(option);
    expect(option).toBeChecked();
  });

  test('scope can be chosen with the keyboard', async () => {
    const user = userEvent.setup();
    render(<ConflictCard conflict={conflict()} {...base} />);
    const first = screen.getByRole('radio', { name: /this interaction/i });
    first.focus();
    expect(first).toHaveFocus();
    await user.keyboard(' ');
    expect(first).toBeChecked();
  });
});

describe('ConflictCard — actions', () => {
  test('Apply is disabled until a scope is chosen', async () => {
    const user = userEvent.setup();
    render(<ConflictCard conflict={conflict()} {...base} />);

    const apply = screen.getByRole('button', { name: /apply preference change/i });
    expect(apply).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /this project/i }));
    expect(apply).toBeEnabled();
  });

  test('passes the chosen scope to the resolver', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<ConflictCard conflict={conflict()} {...base} onResolve={onResolve} />);

    await user.click(screen.getByRole('radio', { name: /this project/i }));
    await user.click(screen.getByRole('button', { name: /apply preference change/i }));

    expect(onResolve).toHaveBeenCalledWith('new_preference', 'project');
  });

  test('passes the future scope when chosen', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<ConflictCard conflict={conflict()} {...base} onResolve={onResolve} />);

    await user.click(screen.getByRole('radio', { name: /all future projects/i }));
    await user.click(screen.getByRole('button', { name: /apply preference change/i }));

    expect(onResolve).toHaveBeenCalledWith('new_preference', 'future');
  });

  test('keeping the previous preference needs no scope', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<ConflictCard conflict={conflict()} {...base} onResolve={onResolve} />);

    await user.click(screen.getByRole('button', { name: /keep previous preference/i }));
    expect(onResolve).toHaveBeenCalledWith('keep_existing');
  });

  test('disables every control while a resolution is in flight', () => {
    render(<ConflictCard conflict={conflict()} {...base} pending />);
    expect(screen.getByRole('button', { name: /apply preference change/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /keep previous preference/i })).toBeDisabled();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });

  test('renders a resolution error', () => {
    render(<ConflictCard conflict={conflict()} {...base} error="Already resolved." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Already resolved.');
  });
});

describe('ConflictCard — scope-only confirmation', () => {
  test('omits the previous-decision block when there is nothing to contradict', () => {
    render(
      <ConflictCard
        conflict={conflict({ oldMemoryId: null, oldStatement: '(no existing preference — scope confirmation required)' })}
        {...base}
      />,
    );
    expect(screen.getByText('Scope confirmation needed')).toBeInTheDocument();
    expect(screen.queryByText('Previous decision')).not.toBeInTheDocument();
    // The scope decision is still required.
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });
});
