import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/clientos', () => import('../test/serviceMock'));

import { ClientWorkspace } from '../pages/ClientWorkspace';
import { renderRoute } from '../test/renderRoute';
import { projects, resetServiceMock } from '../test/serviceMock';
import { MOBILE, WEBSITE } from '../test/fixtures';

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
    expect(await screen.findAllByText(/10 relevant memories/)).not.toHaveLength(0);
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
