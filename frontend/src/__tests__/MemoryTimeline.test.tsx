import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/clientos', () => import('../test/serviceMock'));

import { MemoryTimeline } from '../pages/MemoryTimeline';
import { renderRoute } from '../test/renderRoute';
import { clients, resetServiceMock } from '../test/serviceMock';
import { MOBILE, WEBSITE } from '../test/fixtures';

const ROUTE = '/clients/:clientId/memory';

function open(project = WEBSITE.slug) {
  return renderRoute(ROUTE, <MemoryTimeline />, `/clients/c-vive/memory?project=${project}`);
}

/**
 * The timeline is where the product model has to read clearly: some decisions
 * belong to a project, some belong to the client, and none belong to a sibling
 * project by accident.
 */
describe('MemoryTimeline — active project', () => {
  beforeEach(resetServiceMock);

  test('the active project is visible and selectable', async () => {
    const select = (await open(), await screen.findByLabelText(/^project$/i));
    expect(select).toHaveValue(WEBSITE.slug);
  });

  test('switching project switches the memories shown', async () => {
    const user = userEvent.setup();
    open();
    expect(await screen.findByText(/website decision 1/i)).toBeInTheDocument();

    await user.selectOptions(await screen.findByLabelText(/^project$/i), MOBILE.slug);

    expect(await screen.findByText(/mobile app \(decision 1\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/website decision 1/i)).not.toBeInTheDocument();
  });

  test('the URL keeps the active project', async () => {
    const user = userEvent.setup();
    const { search } = open();
    await user.selectOptions(await screen.findByLabelText(/^project$/i), MOBILE.slug);
    await waitFor(() => expect(search()).toContain(`project=${MOBILE.slug}`));
  });
});

describe('MemoryTimeline — ownership is always stated', () => {
  beforeEach(resetServiceMock);

  test('a project memory names the project that decided it', async () => {
    open();
    const card = (await screen.findByText(/website decision 1/i)).closest('article');
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain(WEBSITE.name);
  });

  test('a memory of the project in context is not flagged as belonging elsewhere', async () => {
    open();
    const card = (await screen.findByText(/website decision 1/i)).closest('article');
    expect(card!.textContent).toContain(WEBSITE.name);
    expect(card!.textContent).not.toContain('another project');
  });

  test('a client-wide memory is shown as applying to all projects', async () => {
    open();
    const card = (await screen.findByText(/values premium positioning/i)).closest('article');
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain('All projects');
    expect(card!.textContent).not.toContain(WEBSITE.name);
  });

  test('the SAME client-wide memory appears under the other project too', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText(/values premium positioning/i);

    await user.selectOptions(await screen.findByLabelText(/^project$/i), MOBILE.slug);

    // One stored memory shown in both places — never copied per project.
    const cards = await screen.findAllByText(/values premium positioning/i);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.closest('article')!.textContent).toContain('All projects');
  });
});

describe('MemoryTimeline — view options', () => {
  beforeEach(resetServiceMock);

  test('defaults to this project plus applicable client-wide context', async () => {
    open();
    expect(await screen.findByRole('tab', { name: /this project/i }))
      .toHaveAttribute('aria-selected', 'true');
    // Both kinds are present by default; a sibling project's are not.
    expect(await screen.findByText(/website decision 1/i)).toBeInTheDocument();
    expect(screen.getByText(/values premium positioning/i)).toBeInTheDocument();
    expect(screen.queryByText(/mobile app \(decision 1\)/i)).not.toBeInTheDocument();
  });

  test('all client memory is NOT the default', async () => {
    open();
    expect(await screen.findByRole('tab', { name: /all client memory/i }))
      .toHaveAttribute('aria-selected', 'false');
    expect(clients.memory).not.toHaveBeenCalled();
  });

  test('the client-wide view shows only memories that belong to the client', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText(/website decision 1/i);

    await user.click(screen.getByRole('tab', { name: /client-wide/i }));

    expect(await screen.findByText(/values premium positioning/i)).toBeInTheDocument();
    expect(screen.queryByText(/website decision 1/i)).not.toBeInTheDocument();
  });

  test('the all-client view spans projects and keeps every memory’s owner', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText(/website decision 1/i);

    await user.click(screen.getByRole('tab', { name: /all client memory/i }));

    const website = await screen.findByText(/website decision 1/i);
    const mobile = await screen.findByText(/mobile app \(decision 1\)/i);
    const wide = screen.getByText(/values premium positioning/i);

    expect(website.closest('article')!.textContent).toContain(WEBSITE.name);
    expect(mobile.closest('article')!.textContent).toContain(MOBILE.name);
    expect(wide.closest('article')!.textContent).toContain('All projects');
    // The memory from the project NOT in context is marked as such, so a broad
    // view can never be mistaken for the active project's own context.
    expect(mobile.closest('article')!.textContent).toContain('another project');
    expect(website.closest('article')!.textContent).not.toContain('another project');
  });

  test('returning to this project drops the other project’s memories again', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('tab', { name: /all client memory/i }));
    await screen.findByText(/mobile app \(decision 1\)/i);

    await user.click(screen.getByRole('tab', { name: /this project/i }));

    await waitFor(() =>
      expect(screen.queryByText(/mobile app \(decision 1\)/i)).not.toBeInTheDocument());
  });
});

describe('MemoryTimeline — retiring a client-wide memory', () => {
  beforeEach(resetServiceMock);

  test('says that retiring it affects every project', async () => {
    const user = userEvent.setup();
    open();
    const card = (await screen.findByText(/values premium positioning/i)).closest('article');

    await user.click(within(card as HTMLElement).getByRole('button', { name: /retire/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/affects every project/i);
  });
});
