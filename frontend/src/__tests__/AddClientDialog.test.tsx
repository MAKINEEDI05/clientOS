import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddClientDialog } from '../components/AddClientDialog';
import { ApiError } from '../lib/api';

const noop = () => undefined;

describe('AddClientDialog', () => {
  test('renders as an accessible dialog', () => {
    render(<AddClientDialog open onClose={noop} onSubmit={vi.fn()} pending={false} error={null} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: /new client/i })).toBeInTheDocument();
  });

  test('renders nothing when closed', () => {
    render(<AddClientDialog open={false} onClose={noop} onSubmit={vi.fn()} pending={false} error={null} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('never mentions memory banks or other implementation detail', () => {
    render(<AddClientDialog open onClose={noop} onSubmit={vi.fn()} pending={false} error={null} />);
    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text).not.toMatch(/bank|hindsight|tag|slug/i);
  });

  test('requires a name before it can be submitted', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddClientDialog open onClose={noop} onSubmit={onSubmit} pending={false} error={null} />);

    expect(screen.getByRole('button', { name: /create client/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/client name/i), 'Vive Studio');
    expect(screen.getByRole('button', { name: /create client/i })).toBeEnabled();
  });

  test('submits name, description and optional first project', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddClientDialog open onClose={noop} onSubmit={onSubmit} pending={false} error={null} />);

    await user.type(screen.getByLabelText(/client name/i), 'Vive Studio');
    await user.type(screen.getByLabelText(/description/i), 'Premium studio.');
    await user.type(screen.getByLabelText(/first project/i), 'Website Redesign');
    await user.click(screen.getByRole('button', { name: /create client/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Vive Studio',
      description: 'Premium studio.',
      firstProjectName: 'Website Redesign',
    });
  });

  test('omits optional fields when left blank', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddClientDialog open onClose={noop} onSubmit={onSubmit} pending={false} error={null} />);

    await user.type(screen.getByLabelText(/client name/i), 'Solo Client');
    await user.click(screen.getByRole('button', { name: /create client/i }));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Solo Client' });
  });

  test('disables submission while a create is in flight', () => {
    render(<AddClientDialog open onClose={noop} onSubmit={vi.fn()} pending error={null} />);
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    expect(screen.getByLabelText(/client name/i)).toBeDisabled();
  });

  test('a memory failure states plainly that nothing was created', () => {
    const error = new ApiError(
      { code: 'MEMORY_UNAVAILABLE', message: 'Memory service unavailable.' }, 503,
    );
    render(<AddClientDialog open onClose={noop} onSubmit={vi.fn()} pending={false} error={error} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/client memory could not be set up/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/Nothing was created/i);
  });

  test('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddClientDialog open onClose={onClose} onSubmit={vi.fn()} pending={false} error={null} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
