import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../services/clientos', () => import('../test/serviceMock'));

import { useMemoryHealth } from '../hooks/useMemoryHealth';
import { health, resetServiceMock } from '../test/serviceMock';

const CONNECTED = {
  connected: true, configured: true, baseUrl: 'https://example.invalid',
  tenant: 'demo', llmConfigured: true, model: 'openai/gpt-oss-120b', demoStage: 'history',
};
const NOT_CONNECTED = { ...CONNECTED, connected: false, reason: 'memory service returned an error' };

/**
 * The probe takes seconds and fails transiently. These assert the two things that
 * follow from that: "checking" is never reported as an outage, and one blip never
 * flips the UI to unavailable.
 */
describe('useMemoryHealth', () => {
  beforeEach(() => {
    resetServiceMock();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('starts in checking — never unavailable before a verdict', () => {
    // A probe that has not resolved yet.
    health.memory.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useMemoryHealth());

    expect(result.current.availability).toBe('checking');
    expect(result.current.checking).toBe(true);
    expect(result.current.unreachable).toBe(false);
  });

  test('reaches connected on a successful probe', async () => {
    health.memory.mockResolvedValue(CONNECTED);
    const { result } = renderHook(() => useMemoryHealth());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(result.current.availability).toBe('connected');
    expect(result.current.checking).toBe(false);
    expect(result.current.status?.connected).toBe(true);
  });

  test('a SINGLE failure does not report unavailable', async () => {
    health.memory.mockResolvedValueOnce(NOT_CONNECTED).mockResolvedValue(CONNECTED);
    const { result } = renderHook(() => useMemoryHealth());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    // Still no verdict — the first failure is held for confirmation.
    expect(result.current.availability).toBe('checking');

    // The confirmation probe succeeds, so the blip never surfaces at all.
    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    expect(result.current.availability).toBe('connected');
  });

  test('a transient failure after connecting does not flicker to unavailable', async () => {
    health.memory.mockResolvedValue(CONNECTED);
    const { result } = renderHook(() => useMemoryHealth(30_000));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.availability).toBe('connected');

    // One failed poll, then recovery on the confirmation probe.
    health.memory.mockResolvedValueOnce(NOT_CONNECTED).mockResolvedValue(CONNECTED);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.availability).toBe('connected');

    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    expect(result.current.availability).toBe('connected');
  });

  test('two consecutive failures DO report unavailable', async () => {
    health.memory.mockResolvedValue(NOT_CONNECTED);
    const { result } = renderHook(() => useMemoryHealth());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.availability).toBe('checking');

    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    expect(result.current.availability).toBe('unavailable');
    expect(result.current.unreachable).toBe(false);
  });

  test('a genuine outage is confirmed in about a second, not held to the next poll', async () => {
    health.memory.mockResolvedValue(NOT_CONNECTED);
    const { result } = renderHook(() => useMemoryHealth(30_000));

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    // Well before the 30s poll interval.
    expect(result.current.availability).toBe('unavailable');
  });

  test('a dead backend is distinguished from unreachable memory', async () => {
    health.memory.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useMemoryHealth());

    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    expect(result.current.availability).toBe('unavailable');
    expect(result.current.unreachable).toBe(true);
  });

  test('recovers to connected after an outage', async () => {
    health.memory.mockResolvedValue(NOT_CONNECTED);
    const { result } = renderHook(() => useMemoryHealth(30_000));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    expect(result.current.availability).toBe('unavailable');

    health.memory.mockResolvedValue(CONNECTED);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.availability).toBe('connected');
    expect(result.current.unreachable).toBe(false);
  });

  test('stops probing once unmounted', async () => {
    health.memory.mockResolvedValue(CONNECTED);
    const { unmount } = renderHook(() => useMemoryHealth(30_000));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const callsAtUnmount = health.memory.mock.calls.length;
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });

    expect(health.memory.mock.calls.length).toBe(callsAtUnmount);
  });
});
