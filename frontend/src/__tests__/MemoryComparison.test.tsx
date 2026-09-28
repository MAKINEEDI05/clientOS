import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryComparison } from '../components/MemoryComparison';

/**
 * The component must be a pure window onto two strings it was handed. If it could
 * contribute recommendation content of its own, the comparison would stop being
 * evidence of anything.
 */
describe('MemoryComparison', () => {
  test('renders exactly the two summaries it was given', () => {
    render(<MemoryComparison without="LEFT SIDE TEXT" with_="RIGHT SIDE TEXT" memoryCount={10} />);
    expect(screen.getByText('LEFT SIDE TEXT')).toBeInTheDocument();
    expect(screen.getByText('RIGHT SIDE TEXT')).toBeInTheDocument();
  });

  test('labels both sides without overstating what memory did', () => {
    const { container } = render(
      <MemoryComparison without="a" with_="b" memoryCount={3} />,
    );
    expect(screen.getByText('Memory changes the direction')).toBeInTheDocument();
    expect(screen.getByText('Without client memory')).toBeInTheDocument();
    expect(screen.getByText('With Hindsight memory')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/smarter|learned everything|100%|revolutionary/i);
  });

  test('reports the recalled count it was given, not an invented one', () => {
    render(<MemoryComparison without="a" with_="b" memoryCount={3} />);
    expect(screen.getByText(/Grounded in 3 recalled memories/)).toBeInTheDocument();
  });

  test('uses the singular for a single memory', () => {
    render(<MemoryComparison without="a" with_="b" memoryCount={1} />);
    expect(screen.getByText(/Grounded in 1 recalled memory/)).toBeInTheDocument();
  });

  test('states plainly that the left side used no client history', () => {
    render(<MemoryComparison without="a" with_="b" memoryCount={2} />);
    expect(screen.getByText(/No previous client decisions were used/)).toBeInTheDocument();
  });

  test('carries no recommendation content of its own', () => {
    // Arbitrary content in, and nothing resembling a client decision baked in.
    const { container } = render(
      <MemoryComparison without="AAA" with_="BBB" memoryCount={1} />,
    );
    const text = container.textContent ?? '';
    expect(text).toMatch(/AAA/);
    expect(text).toMatch(/BBB/);
    // No demo vocabulary, no client names, no design language.
    expect(text).not.toMatch(
      /muted|palette|serif|typography|animation|headline|Vive|Northwind|premium positioning/i,
    );
  });

  test('is exposed as a labelled region rather than an unnamed block', () => {
    render(<MemoryComparison without="a" with_="b" memoryCount={1} />);
    expect(screen.getByRole('region', { name: /memory changes the direction/i })).toBeInTheDocument();
  });
});
