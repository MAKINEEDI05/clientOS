import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenerationProgress } from '../components/GenerationProgress';

/**
 * The wait state must not claim progress it cannot observe. A recommendation is
 * one round trip, so any per-phase "done" marker would be invented.
 */
describe('GenerationProgress', () => {
  test('with memory, names what the request will do', () => {
    render(<GenerationProgress useMemory clientName="Vive Studio" />);
    expect(screen.getByText(/Recalling Vive Studio's decisions and writing a direction/))
      .toBeInTheDocument();
  });

  test('without memory, it does NOT say it is recalling anything', () => {
    const { container } = render(<GenerationProgress useMemory={false} clientName="Vive Studio" />);
    expect(screen.getByText(/Writing a direction/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/recalling/i);
    expect(screen.getByText(/no previous decision will be recalled or used/i)).toBeInTheDocument();
  });

  test('claims no percentage, no step count and no elapsed time', () => {
    const { container } = render(<GenerationProgress useMemory clientName="Vive Studio" />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/\bstep\b/i);
    expect(text).not.toMatch(/\d+\s*(s|sec|second|ms)\b/i);
    expect(text).not.toMatch(/\d+\s*of\s*\d+/);
  });

  test('marks nothing as completed — completion is not observable', () => {
    const { container } = render(<GenerationProgress useMemory clientName="Vive Studio" />);
    // No tick glyphs, and no element styled as a finished step.
    expect(container.textContent).not.toMatch(/[✓✔]/);
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  test('exposes itself as a live status region', () => {
    render(<GenerationProgress useMemory />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  test('works without a client name', () => {
    const { container } = render(<GenerationProgress useMemory />);
    expect(screen.getByText(/Recalling this client's decisions/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/undefined/);
  });

  test('states that it is a single request, not a multi-phase pipeline', () => {
    render(<GenerationProgress useMemory clientName="Vive Studio" />);
    expect(screen.getByText(/One request:/)).toBeInTheDocument();
  });
});
