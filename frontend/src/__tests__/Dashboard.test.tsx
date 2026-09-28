import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('../services/clientos', () => import('../test/serviceMock'));

import { Dashboard } from '../pages/Dashboard';
import { renderRoute } from '../test/renderRoute';
import { resetServiceMock } from '../test/serviceMock';

const open = () => renderRoute('/', <Dashboard />, '/');

/**
 * The first screen decides what a newcomer thinks the product is. It previously
 * opened on the word "Clients", which reads as a contacts list.
 */
describe('Dashboard — positioning', () => {
  beforeEach(resetServiceMock);

  test('leads with what the product is for, not with a list of clients', async () => {
    open();
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(/never lose the reason behind a client decision/i);
  });

  test('names the product category without leading on the technology', async () => {
    open();
    expect(await screen.findByText(/client decision memory/i)).toBeInTheDocument();
  });

  test('says what it remembers in the client’s own terms', async () => {
    open();
    expect(await screen.findByText(/approved, rejected, required and changed their mind about/i))
      .toBeInTheDocument();
  });

  test('the client list is still a labelled section, so navigation is unharmed', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Clients' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Vive Studio/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Northwind Labs/ })).toBeInTheDocument();
  });

  test('states that clients are isolated from one another', async () => {
    open();
    expect(await screen.findByText(/Nothing crosses between them/i)).toBeInTheDocument();
  });

  test('client cards lead on decisions, not contact-database fields', async () => {
    open();
    await screen.findByRole('link', { name: /Vive Studio/ });
    expect(screen.getAllByText('Decisions').length).toBeGreaterThan(0);
    // No CRM furniture.
    expect(screen.queryByText(/phone|address|deal|pipeline|revenue|contact/i)).not.toBeInTheDocument();
  });

  test('claims no automatic ingestion of email, meetings, calls or documents', async () => {
    const { container } = open();
    await screen.findByRole('heading', { level: 1 });
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/automatic|integrat|sync|connect your|import from|transcri/i);
    expect(text).not.toMatch(/reads your (email|inbox|slack|calendar)/i);
  });

  test('uses no inflated marketing language', async () => {
    const { container } = open();
    await screen.findByRole('heading', { level: 1 });
    expect(container.textContent).not.toMatch(
      /revolutionary|next-generation|ecosystem|synergy|transform your|enterprise-grade|cognitive|100%/i,
    );
  });
});
