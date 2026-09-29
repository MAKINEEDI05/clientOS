import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

vi.mock('../services/clientos', () => import('../test/serviceMock'));

import { ClientWorkspace } from '../pages/ClientWorkspace';
import { Dashboard } from '../pages/Dashboard';
import { ApiError } from '../lib/api';
import { clients, resetServiceMock } from '../test/serviceMock';
import { CLIENT, NORTHWIND_SUMMARY, WEBSITE } from '../test/fixtures';

const TOKEN = 'operator-supplied-token';

/**
 * The workspace and the dashboard under one router, so a deletion's navigation,
 * the fresh client list and the absence of stale data are all observable.
 */
function openWorkspace() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Dashboard /> },
      { path: '/clients/:clientId', element: <ClientWorkspace /> },
    ],
    { initialEntries: [`/clients/${CLIENT.client.id}?project=${WEBSITE.slug}`] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /delete client…/i }));
  return screen.getByRole('dialog', { name: /delete vive studio\?/i });
}

const confirmButton = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: /^delete client$/i });

async function fillDialog(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: string, token = TOKEN) {
  await user.type(within(dialog).getByLabelText(/to confirm/i), name);
  if (token) await user.type(within(dialog).getByLabelText(/admin token/i), token);
}

describe('Delete client — action and dialog', () => {
  beforeEach(() => {
    resetServiceMock();
    sessionStorage.clear();
  });

  test('the Delete client action renders in client settings, not as a primary action', async () => {
    openWorkspace();
    const button = await screen.findByRole('button', { name: /delete client…/i });
    expect(screen.getByRole('heading', { name: 'Client settings' })).toBeInTheDocument();
    expect(button).not.toHaveClass('btn-primary');
    // Nothing is deleted just by rendering or by opening.
    expect(clients.remove).not.toHaveBeenCalled();
  });

  test('clicking it opens a confirmation dialog and deletes nothing', async () => {
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(clients.remove).not.toHaveBeenCalled();
  });

  test('the dialog names the client', async () => {
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    expect(within(dialog).getByRole('heading', { name: 'Delete Vive Studio?' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Type “Vive Studio” to confirm/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/cannot be undone/i);
  });

  test('the project count is the client’s real count', async () => {
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    expect(within(dialog).getByText(`${CLIENT.projects.length} projects`)).toBeInTheDocument();
  });

  test('a client with no projects says 0 projects', async () => {
    clients.get.mockResolvedValue({ ...CLIENT, projects: [] });
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    expect(within(dialog).getByText('0 projects')).toBeInTheDocument();
  });

  test('the confirmation field is empty and the delete button starts disabled', async () => {
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    expect(within(dialog).getByLabelText(/to confirm/i)).toHaveValue('');
    expect(confirmButton(dialog)).toBeDisabled();
  });

  test('wrong confirmation text keeps it disabled', async () => {
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    // A valid token throughout, so only the name decides.
    await user.type(within(dialog).getByLabelText(/admin token/i), TOKEN);
    const field = within(dialog).getByLabelText(/to confirm/i);
    for (const attempt of ['vive studio', 'Vive Studi', 'Vive Studio ', 'Northwind Labs']) {
      await user.clear(field);
      await user.type(field, attempt);
      expect(confirmButton(dialog)).toBeDisabled();
    }
  });

  test('the exact name alone is not enough — the admin token is also required', async () => {
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    await fillDialog(user, dialog, 'Vive Studio', '');
    expect(confirmButton(dialog)).toBeDisabled();
  });

  test('the exact client name plus a token enables deletion', async () => {
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    await fillDialog(user, dialog, 'Vive Studio');
    expect(confirmButton(dialog)).toBeEnabled();
  });

  test('Cancel closes the dialog without any API call', async () => {
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    await fillDialog(user, dialog, 'Vive Studio');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(clients.remove).not.toHaveBeenCalled();
  });

  test('Escape closes it when idle', async () => {
    const user = userEvent.setup();
    openWorkspace();
    await openDialog(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Delete client — the request', () => {
  beforeEach(() => {
    resetServiceMock();
    sessionStorage.clear();
  });

  test('success calls DELETE for this client id with the token typed', async () => {
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    await fillDialog(user, dialog, 'Vive Studio');
    await user.click(confirmButton(dialog));
    await waitFor(() => expect(clients.remove).toHaveBeenCalledTimes(1));
    expect(clients.remove).toHaveBeenCalledWith(CLIENT.client.id, TOKEN);
  });

  test('while deleting: a loading state, every control disabled, no second request, Escape ignored', async () => {
    let finish!: (v: unknown) => void;
    clients.remove.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    await fillDialog(user, dialog, 'Vive Studio');
    await user.click(confirmButton(dialog));

    const busy = within(dialog).getByRole('button', { name: /deleting client…/i });
    expect(busy).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(within(dialog).getByLabelText(/to confirm/i)).toBeDisabled();
    expect(within(dialog).getByLabelText(/admin token/i)).toBeDisabled();
    expect(within(dialog).queryByText(/%/)).not.toBeInTheDocument();

    await user.click(busy);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(clients.remove).toHaveBeenCalledTimes(1);

    finish({ clientId: CLIENT.client.id, deletedProjects: 2 });
  });

  test('success navigates to the client list, replacing the deleted client’s URL', async () => {
    const user = userEvent.setup();
    const router = openWorkspace();
    const dialog = await openDialog(user);
    await fillDialog(user, dialog, 'Vive Studio');
    await user.click(confirmButton(dialog));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  test('the deleted client disappears from the client list, with a confirmation', async () => {
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    await fillDialog(user, dialog, 'Vive Studio');
    // What the server returns once the client is gone.
    clients.list.mockResolvedValue({ clients: [NORTHWIND_SUMMARY] });
    await user.click(confirmButton(dialog));

    expect(await screen.findByText('Vive Studio was deleted.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Northwind Labs/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Vive Studio/ })).not.toBeInTheDocument();
  });

  test('no stale client or project data remains after deletion', async () => {
    sessionStorage.setItem(`clientos:last-direction:${WEBSITE.id}`, 'A previous direction.');
    sessionStorage.setItem(
      `clientos:memory-off:${CLIENT.client.id}:${WEBSITE.id}`,
      JSON.stringify({ request: 'x', summary: 'y', recommendationId: 'r' }),
    );
    const user = userEvent.setup();
    openWorkspace();
    const dialog = await openDialog(user);
    await fillDialog(user, dialog, 'Vive Studio');
    clients.list.mockResolvedValue({ clients: [NORTHWIND_SUMMARY] });
    await user.click(confirmButton(dialog));

    await screen.findByText('Vive Studio was deleted.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(WEBSITE.name)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /decision memory/i })).not.toBeInTheDocument();
    expect(sessionStorage.getItem(`clientos:last-direction:${WEBSITE.id}`)).toBeNull();
    expect(sessionStorage.getItem(`clientos:memory-off:${CLIENT.client.id}:${WEBSITE.id}`)).toBeNull();
  });
});

describe('Delete client — failures', () => {
  beforeEach(() => {
    resetServiceMock();
    sessionStorage.clear();
  });

  async function failWith(error: unknown) {
    clients.remove.mockRejectedValue(error);
    const user = userEvent.setup();
    const router = openWorkspace();
    const dialog = await openDialog(user);
    await fillDialog(user, dialog, 'Vive Studio');
    await user.click(confirmButton(dialog));
    const alert = await within(dialog).findByRole('alert');
    return { router, dialog, alert, user };
  }

  test('an API failure keeps the client visible and the dialog open, and allows retry', async () => {
    const { router, dialog, alert, user } = await failWith(
      new ApiError({ code: 'MEMORY_UNAVAILABLE', message: 'Memory service unavailable.' }, 503),
    );
    expect(alert).toHaveTextContent('Client memory could not be deleted');
    expect(alert).toHaveTextContent(/the client and all of its data were kept/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/clients/${CLIENT.client.id}`);
    expect(screen.queryByText(/was deleted\./)).not.toBeInTheDocument();
    // The workspace behind it still shows the client.
    expect(screen.getAllByText('Vive Studio').length).toBeGreaterThan(0);

    clients.remove.mockResolvedValue({ clientId: CLIENT.client.id, deletedProjects: 2 });
    expect(confirmButton(dialog)).toBeEnabled();
    await user.click(confirmButton(dialog));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  test('a rejected token says nothing was deleted', async () => {
    const { alert } = await failWith(new ApiError({ code: 'UNAUTHORIZED', message: 'A valid demo token is required.' }, 401));
    expect(alert).toHaveTextContent('Admin token not accepted');
    expect(alert).toHaveTextContent('Nothing was deleted.');
  });

  test('a partial failure is shown in the server’s own words, not as success', async () => {
    const message = "The client's memory bank was deleted, but the client record could not be removed and was kept. Delete the client again to finish.";
    const { alert } = await failWith(new ApiError({ code: 'INTERNAL', message, requestId: 'req-9' }, 500));
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveTextContent('ref req-9');
    expect(alert).not.toHaveTextContent(/nothing was deleted/i);
  });

  test('a network failure does not claim anything was or was not deleted', async () => {
    const { alert } = await failWith(new ApiError({ code: 'NETWORK', message: 'Could not reach the ClientOS server.' }, 0));
    expect(alert).toHaveTextContent('the deletion could not be confirmed');
    expect(alert).not.toHaveTextContent(/nothing was deleted/i);
  });

  test('a client that is already gone is reported as not found', async () => {
    const { alert } = await failWith(new ApiError({ code: 'NOT_FOUND', message: 'Client not found' }, 404));
    expect(alert).toHaveTextContent('Vive Studio no longer exists');
  });

  test('a server without the delete route is not mistaken for a missing client', async () => {
    const { alert } = await failWith(new ApiError(
      { code: 'NOT_FOUND', message: `No route matches DELETE /api/clients/${CLIENT.client.id}` }, 404));
    expect(alert).toHaveTextContent('Deleting clients is not available on this server');
    expect(alert).toHaveTextContent('Nothing was deleted.');
    expect(alert).not.toHaveTextContent(/no longer exists/);
  });
});
