import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryCard } from '../components/MemoryCard';
import { CLIENT_WIDE, MOBILE, WEBSITE, memory } from '../test/fixtures';

/**
 * One client, many projects: a card must always say which project a decision
 * belongs to, and a client-wide decision must never be attributed to whichever
 * project happens to be open.
 */
describe('MemoryCard — ownership', () => {
  test('a project memory names its project', () => {
    render(<MemoryCard memory={memory()} activeProjectId={WEBSITE.id} />);
    expect(screen.getByText(WEBSITE.name)).toBeInTheDocument();
  });

  test('a client-wide memory is shown as applying to all projects', () => {
    render(<MemoryCard memory={CLIENT_WIDE} activeProjectId={WEBSITE.id} />);
    expect(screen.getByText(/all projects/i)).toBeInTheDocument();
  });

  test('a client-wide memory is never attributed to the project in context', () => {
    const { container } = render(<MemoryCard memory={CLIENT_WIDE} activeProjectId={WEBSITE.id} />);
    expect(container.textContent).not.toContain(WEBSITE.name);
  });

  test('a memory owned by another project is flagged as such', () => {
    const other = memory({
      id: 'm-other',
      project: { id: MOBILE.id, slug: MOBILE.slug, name: MOBILE.name },
    });
    render(<MemoryCard memory={other} activeProjectId={WEBSITE.id} />);
    expect(screen.getByText(MOBILE.name)).toBeInTheDocument();
    expect(screen.getByText(/another project/i)).toBeInTheDocument();
  });

  test('ownership and reach are worded differently, so they cannot be confused', () => {
    const { container } = render(<MemoryCard memory={memory()} activeProjectId={WEBSITE.id} />);
    // "This project" is the SCOPE badge — it describes how far the decision
    // reaches, not which project owns it.
    expect(screen.getByText('This project')).toBeInTheDocument();
    expect(container.textContent).not.toContain('another project');
  });

  test('a compact card names only the memory that reaches beyond the project', () => {
    const { container: own } = render(<MemoryCard memory={memory()} compact />);
    expect(own.textContent).not.toContain(WEBSITE.name);

    const { container: wide } = render(<MemoryCard memory={CLIENT_WIDE} compact />);
    expect(wide.textContent).toContain('All projects');
  });
});
