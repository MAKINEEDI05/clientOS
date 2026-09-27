import { useEffect, useState } from 'react';
import { health } from '../services/clientos';
import type { HealthStatus } from '../types/api';

/**
 * Poll the memory-layer health so the UI can always tell the truth about whether
 * Hindsight is connected. This is the mechanism that stops any screen implying
 * memory worked when it did not.
 */
export function useMemoryHealth(intervalMs = 30_000): {
  status: HealthStatus | null;
  checking: boolean;
  unreachable: boolean;
  refresh: () => void;
} {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const result = await health.memory();
        if (!active) return;
        setStatus(result);
        setUnreachable(false);
      } catch {
        if (!active) return;
        // Backend itself is down — distinct from "Hindsight is down".
        setUnreachable(true);
      } finally {
        if (active) setChecking(false);
      }
    };

    void check();
    const timer = setInterval(() => void check(), intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [intervalMs, nonce]);

  return { status, checking, unreachable, refresh: () => setNonce((n) => n + 1) };
}
