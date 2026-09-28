import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientContextBar } from '../components/ClientContextBar';
import { MemoryToggle } from '../components/MemoryToggle';
import type { MemoryAvailability } from '../hooks/useMemoryHealth';

const bar = (availability: MemoryAvailability, memoryEnabled = true) => (
  <ClientContextBar
    clientName="Vive Studio"
    projectName="Premium Website Redesign"
    memoryCount={10}
    memoryAvailability={availability}
    memoryEnabled={memoryEnabled}
  />
);

const toggle = (availability: MemoryAvailability, enabled = true) => (
  <MemoryToggle
    enabled={enabled}
    onChange={vi.fn()}
    clientName="Vive Studio"
    memoryCount={10}
    memoryAvailability={availability}
  />
);

/**
 * "Still checking" and "unavailable" are different facts. Reporting the first as
 * the second is the one dishonesty this product cannot afford, so it is asserted
 * rather than assumed.
 */
describe('memory status — checking', () => {
  test('the context bar says it is checking', () => {
    render(bar('checking'));
    expect(screen.getByText('Checking client memory…')).toBeInTheDocument();
  });

  test('the context bar does NOT claim unavailable while checking', () => {
    const { container } = render(bar('checking'));
    expect(container.textContent).not.toMatch(/unavailable/i);
  });

  test('the context bar does NOT claim memory is in use while checking', () => {
    const { container } = render(bar('checking'));
    expect(container.textContent).not.toMatch(/Using Vive Studio's Hindsight memory/);
  });

  test('the switch says it is checking and is disabled', () => {
    render(toggle('checking'));
    expect(screen.getByText('checking…')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /client memory/i })).toBeDisabled();
  });

  test('the switch does NOT claim unavailable while checking', () => {
    const { container } = render(toggle('checking'));
    expect(container.textContent).not.toMatch(/cannot be reached/i);
    expect(container.textContent).toMatch(/Checking whether this client’s memory can be reached/);
  });

  test('no memory count is promised before availability is known', () => {
    const { container } = render(toggle('checking'));
    expect(container.textContent).not.toMatch(/10 memories available/);
  });
});

describe('memory status — connected', () => {
  test('the context bar names the memory in use', () => {
    render(bar('connected'));
    expect(screen.getByText("Using Vive Studio's Hindsight memory")).toBeInTheDocument();
  });

  test('memory switched off is distinct from unavailable', () => {
    const { container } = render(bar('connected', false));
    expect(screen.getByText('Client memory is off for this request')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/unavailable/i);
  });

  test('the switch is usable and reports ON', () => {
    render(toggle('connected'));
    expect(screen.getByText('ON')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /client memory/i })).toBeEnabled();
  });

  test('the switch reports OFF without implying an outage', () => {
    const { container } = render(toggle('connected', false));
    expect(screen.getByText('OFF')).toBeInTheDocument();
    expect(screen.getByText(/Generate without previous client decisions/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/unavailable|cannot be reached/i);
  });
});

describe('memory status — unavailable', () => {
  test('the context bar reports it plainly', () => {
    render(bar('unavailable'));
    expect(screen.getByText('Client memory is temporarily unavailable')).toBeInTheDocument();
  });

  test('an unavailable bar never claims memory is in use', () => {
    const { container } = render(bar('unavailable'));
    expect(container.textContent).not.toMatch(/Using Vive Studio's Hindsight memory/);
    expect(container.textContent).not.toMatch(/Checking/i);
  });

  test('the switch is disabled and explains why', () => {
    render(toggle('unavailable'));
    expect(screen.getByText('unavailable')).toBeInTheDocument();
    expect(screen.getByText(/cannot be reached, so previous decisions cannot be used/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /client memory/i })).toBeDisabled();
  });

  test('an unavailable switch never reports ON, even when the user had it on', () => {
    const { container } = render(toggle('unavailable', true));
    expect(container.textContent).not.toMatch(/\bON\b/);
  });
});
