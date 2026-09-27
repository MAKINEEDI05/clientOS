import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState, EmptyState, LoadingState } from '../components/States';
import { ApiError } from '../lib/api';

describe('LoadingState', () => {
  test('announces itself to assistive technology', () => {
    render(<LoadingState label="Generating recommendation" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Generating recommendation')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  test('renders a title and description', () => {
    render(<EmptyState title="No memories yet" description="Record an interaction." />);
    expect(screen.getByText('No memories yet')).toBeInTheDocument();
    expect(screen.getByText('Record an interaction.')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  test('a MEMORY failure is labelled as such and disclaims memory use', () => {
    const error = new ApiError(
      { code: 'MEMORY_UNAVAILABLE', message: 'Memory service unavailable.' }, 503,
    );
    render(<ErrorState error={error} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Memory unavailable')).toBeInTheDocument();
    expect(screen.getByText(/No client history was used/i)).toBeInTheDocument();
  });

  test('an AI failure is distinguished from a memory failure', () => {
    const error = new ApiError({ code: 'LLM_UNAVAILABLE', message: 'AI failed.' }, 503);
    render(<ErrorState error={error} />);
    expect(screen.getByText('AI unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/No client history was used/i)).not.toBeInTheDocument();
  });

  test('a network failure tells the user the app cannot be reached', () => {
    const error = new ApiError({ code: 'NETWORK', message: 'Could not reach the ClientOS server.' }, 0);
    render(<ErrorState error={error} />);
    expect(screen.getByText('Cannot reach ClientOS')).toBeInTheDocument();
  });

  test('offers retry for a retryable failure and calls it', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const error = new ApiError({ code: 'MEMORY_UNAVAILABLE', message: 'down' }, 503);
    render(<ErrorState error={error} onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test('does NOT offer retry for a validation error', () => {
    const error = new ApiError({ code: 'VALIDATION_ERROR', message: 'bad input' }, 400);
    render(<ErrorState error={error} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  test('shows the request id so a failure can be traced in logs', () => {
    const error = new ApiError({ code: 'INTERNAL', message: 'oops', requestId: 'abc-123' }, 500);
    render(<ErrorState error={error} />);
    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
  });
});
