import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/clientos', () => import('../test/serviceMock'));

import { AIWorkspace } from '../pages/AIWorkspace';
import { renderRoute } from '../test/renderRoute';
import { agent, resetServiceMock } from '../test/serviceMock';
import { MOBILE, WEBSITE } from '../test/fixtures';

const ROUTE = '/clients/:clientId/ai';

function open(project = WEBSITE.slug) {
  return renderRoute(ROUTE, <AIWorkspace />, `/clients/c-vive/ai?project=${project}`);
}

/**
 * The AI workspace has to make the active project obvious, because the project
 * decides which of the client's memories the recommendation is allowed to use.
 */
describe('AIWorkspace — project context', () => {
  beforeEach(resetServiceMock);

  test('renders a project selector', async () => {
    open();
    expect(await screen.findByLabelText(/^project$/i)).toBeInTheDocument();
  });

  test('the project from the URL is the selected one', async () => {
    open();
    expect(await screen.findByLabelText(/^project$/i)).toHaveValue(WEBSITE.slug);
  });

  test('lists every project belonging to the client, and nothing else', async () => {
    open();
    const select = await screen.findByLabelText(/^project$/i);
    const options = [...select.querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual([WEBSITE.name, MOBILE.name]);
  });

  test('selecting another project makes it the active one', async () => {
    const user = userEvent.setup();
    open();
    const select = await screen.findByLabelText(/^project$/i);

    await user.selectOptions(select, MOBILE.slug);

    expect(select).toHaveValue(MOBILE.slug);
    // The rest of the page follows: the memory context is the mobile project's.
    expect(await screen.findAllByText(/3 relevant memories/)).not.toHaveLength(0);
  });

  test('the URL carries the active project, so the view is shareable', async () => {
    const user = userEvent.setup();
    const { search } = open();
    await user.selectOptions(await screen.findByLabelText(/^project$/i), MOBILE.slug);

    await waitFor(() => expect(search()).toContain(`project=${MOBILE.slug}`));
    expect(search()).not.toContain(WEBSITE.slug);
  });
});

describe('AIWorkspace — relevant memory count', () => {
  beforeEach(resetServiceMock);

  test('states the count as the active project’s relevant context', async () => {
    open();
    // 9 website decisions + 1 client-wide. Stated in the context bar and again on
    // the memory switch, so both places have to agree.
    expect(await screen.findAllByText(/10 relevant memories/)).not.toHaveLength(0);
  });

  test('breaks the count down into project and client-wide memory', async () => {
    open();
    expect(await screen.findByText(/9 project decisions \+ 1 client-wide/)).toBeInTheDocument();
  });

  test('the count changes with the project', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText(/10 relevant memories/);

    await user.selectOptions(await screen.findByLabelText(/^project$/i), MOBILE.slug);

    // 2 mobile decisions + the same 1 client-wide memory.
    expect(await screen.findAllByText(/3 relevant memories/)).not.toHaveLength(0);
    expect(await screen.findByText(/2 project decisions \+ 1 client-wide/)).toBeInTheDocument();
  });

  test('never shows a sibling project’s count', async () => {
    const user = userEvent.setup();
    const { container } = open();
    await screen.findAllByText(/10 relevant memories/);

    await user.selectOptions(await screen.findByLabelText(/^project$/i), MOBILE.slug);
    await screen.findAllByText(/3 relevant memories/);

    expect(container.textContent).not.toMatch(/10 relevant memor/);
  });
});

describe('AIWorkspace — generation uses the active project', () => {
  beforeEach(resetServiceMock);

  test('asks for a recommendation against the active project', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByLabelText(/^project$/i);

    await user.click(screen.getByRole('button', { name: /generate direction/i }));

    await waitFor(() => expect(agent.recommend).toHaveBeenCalled());
    expect(agent.recommend).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: WEBSITE.id, useMemory: true }),
    );
  });

  test('after switching project, the recommendation uses the NEW project', async () => {
    const user = userEvent.setup();
    open();
    await user.selectOptions(await screen.findByLabelText(/^project$/i), MOBILE.slug);
    await screen.findAllByText(/3 relevant memories/);

    await user.click(screen.getByRole('button', { name: /generate direction/i }));

    await waitFor(() => expect(agent.recommend).toHaveBeenCalled());
    expect(agent.recommend).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: MOBILE.id }),
    );
    expect(agent.recommend).not.toHaveBeenCalledWith(
      expect.objectContaining({ projectId: WEBSITE.id }),
    );
    expect(await screen.findByText(/Grounded direction for the mobile app/)).toBeInTheDocument();
  });

  test('a direction generated for one project is cleared when the project changes', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByLabelText(/^project$/i);
    await user.click(screen.getByRole('button', { name: /generate direction/i }));
    expect(await screen.findByText(/Grounded direction for the website/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^project$/i), MOBILE.slug);

    // The website's direction must not sit under the mobile project's name.
    await waitFor(() =>
      expect(screen.queryByText(/Grounded direction for the website/)).not.toBeInTheDocument());
  });
});

describe('AIWorkspace — memory off', () => {
  beforeEach(resetServiceMock);

  test('generating with memory off uses no client history', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByLabelText(/^project$/i);

    await user.click(screen.getByRole('checkbox', { name: /client memory/i }));
    await user.click(screen.getByRole('button', { name: /generate direction/i }));

    await waitFor(() => expect(agent.recommend).toHaveBeenCalled());
    expect(agent.recommend).toHaveBeenCalledWith(expect.objectContaining({ useMemory: false }));
    expect(await screen.findByText('Memory off')).toBeInTheDocument();
    expect(screen.getByText(/does not use previous client decisions/i)).toBeInTheDocument();
  });

  test('switching project while memory is off does not switch memory back on', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByLabelText(/^project$/i);

    const toggle = screen.getByRole('checkbox', { name: /client memory/i });
    await user.click(toggle);
    expect(toggle).not.toBeChecked();

    await user.selectOptions(screen.getByLabelText(/^project$/i), MOBILE.slug);
    await screen.findAllByText(/3 relevant memories/);

    expect(screen.getByRole('checkbox', { name: /client memory/i })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: /generate direction/i }));
    await waitFor(() => expect(agent.recommend).toHaveBeenCalled());
    expect(agent.recommend).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: MOBILE.id, useMemory: false }),
    );
  });
});
