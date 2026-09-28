import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/clientos', () => import('../test/serviceMock'));

import { ClientWorkspace } from '../pages/ClientWorkspace';
import { renderRoute } from '../test/renderRoute';
import { clients, projects, resetServiceMock } from '../test/serviceMock';
import { CLIENT, MOBILE, WEBSITE } from '../test/fixtures';

const ROUTE = '/clients/:clientId';

function open(project = WEBSITE.slug) {
  return renderRoute(ROUTE, <ClientWorkspace />, `/clients/c-vive?project=${project}`);
}

/**
 * The client workspace holds the PRIMARY project switcher, and it is where
 * feedback is recorded — so the project that feedback lands on must be stated,
 * never inferred.
 */
describe('ClientWorkspace — project switching', () => {
  beforeEach(resetServiceMock);

  test('lists the client’s projects as tabs with the active one selected', async () => {
    open();
    expect(await screen.findByRole('tab', { name: new RegExp(WEBSITE.name, 'i') }))
      .toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: new RegExp(MOBILE.name, 'i') }))
      .toHaveAttribute('aria-selected', 'false');
  });

  test('switching project loads that project and updates the URL', async () => {
    const user = userEvent.setup();
    const { search } = open();
    await screen.findByRole('tab', { name: new RegExp(MOBILE.name, 'i') });

    await user.click(screen.getByRole('tab', { name: new RegExp(MOBILE.name, 'i') }));

    await waitFor(() => expect(search()).toContain(`project=${MOBILE.slug}`));
    await waitFor(() => expect(projects.get).toHaveBeenCalledWith(MOBILE.id, expect.anything()));
  });

  test('states the relevant memory count and what it is made of', async () => {
    open();
    expect(await screen.findAllByText(/10 memories available to this project/)).not.toHaveLength(0);
    expect(screen.getByText(/9 project decisions \+ 1 client-wide/)).toBeInTheDocument();
  });
});

describe('ClientWorkspace — feedback destination', () => {
  beforeEach(resetServiceMock);

  test('names the project the feedback will be recorded against', async () => {
    open();
    const form = (await screen.findByLabelText(/what the client said/i)).closest('form');
    expect(form!.textContent).toContain('Adding feedback to');
    expect(form!.textContent).toContain(WEBSITE.name);
  });

  test('the named project follows the active project', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('tab', { name: new RegExp(MOBILE.name, 'i') });

    await user.click(screen.getByRole('tab', { name: new RegExp(MOBILE.name, 'i') }));

    const form = (await screen.findByLabelText(/what the client said/i)).closest('form');
    await waitFor(() => expect(form!.textContent).toContain(MOBILE.name));
    expect(form!.textContent).not.toContain(WEBSITE.name);
  });

  test('feedback is submitted against the ACTIVE project, not the first one', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('tab', { name: new RegExp(MOBILE.name, 'i') });
    await user.click(screen.getByRole('tab', { name: new RegExp(MOBILE.name, 'i') }));
    await waitFor(() => expect(projects.get).toHaveBeenCalledWith(MOBILE.id, expect.anything()));

    await user.type(screen.getByLabelText(/label/i), 'UX Review #3');
    await user.type(screen.getByLabelText(/what the client said/i), 'Keep the navigation shallow.');
    await user.click(screen.getByRole('button', { name: /add feedback/i }));

    await waitFor(() => expect(projects.submitInteraction).toHaveBeenCalled());
    expect(projects.submitInteraction).toHaveBeenCalledWith(MOBILE.id, {
      label: 'UX Review #3',
      source: 'revision',
      content: 'Keep the navigation shallow.',
    });
  });
});

/**
 * One client, one memory, several projects. The workspace has to make the
 * boundary legible without naming any project in the component itself.
 */
describe('ClientWorkspace — multi-project memory story', () => {
  beforeEach(resetServiceMock);

  test('says the client’s projects share one memory, using the real count and name', async () => {
    open();
    expect(await screen.findByText(/2 projects share Vive Studio's memory/)).toBeInTheDocument();
  });

  test('states the boundary in behaviour, not architecture', async () => {
    open();
    expect(await screen.findByText(/Decisions recorded on a\s+project stay with that project/))
      .toBeInTheDocument();
    expect(screen.getByText(/client-wide decisions can inform any of them/i)).toBeInTheDocument();
  });

  test('exposes no memory-layer jargon', async () => {
    const { container } = open();
    await screen.findByText(/2 projects share Vive Studio's memory/);
    expect(container.textContent).not.toMatch(/any_strict|tag group|bank filter|SQL|scope tag/i);
  });

  test('a single-project client gets wording that still explains the boundary', async () => {
    clients.get.mockResolvedValue({ ...CLIENT, projects: [WEBSITE] });
    open();
    expect(await screen.findByText(/Decisions recorded here stay with this project/))
      .toBeInTheDocument();
    expect(screen.getByText(/including ones added later/)).toBeInTheDocument();
  });

  test('does not promise that every client-wide decision reaches every answer', async () => {
    open();
    await screen.findByText(/2 projects share Vive Studio's memory/);
    expect(screen.getByText(/depends on the question asked/)).toBeInTheDocument();
  });

  test('switching project is described as changing what ClientOS draws on', async () => {
    open();
    expect(await screen.findByText(/Switching project changes what ClientOS draws on/))
      .toBeInTheDocument();
  });
});
