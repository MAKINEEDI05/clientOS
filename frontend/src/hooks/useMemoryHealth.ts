import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { health } from '../services/clientos';
import type { HealthStatus } from '../types/api';

/**
 * Three states, because two cannot tell the truth.
 *
 * `checking` is not the same as `unavailable`: the probe takes a few seconds, and
 * reporting an outage while we are still asking would be a lie in the one place
 * the product must never lie. `connected` is only ever claimed on a confirmed
 * authenticated probe.
 */
export type MemoryAvailability = 'checking' | 'connected' | 'unavailable';

/**
 * One fast confirmation probe before reporting an outage.
 *
 * The probe fails transiently in practice. Announcing `unavailable` on a single
 * failure produced connected → unavailable → connected flicker and disabled the
 * memory switch mid-use. Requiring two consecutive failures removes that, and
 * confirming after ~1.5s rather than at the next 30s poll means a genuine outage
 * is still surfaced almost immediately — it is delayed, never hidden.
 */
const CONFIRM_DELAY_MS = 1_500;
const FAILURES_BEFORE_UNAVAILABLE = 2;

export interface MemoryHealth {
  status: HealthStatus | null;
  availability: MemoryAvailability;
  /** True only while no verdict has been reached yet. */
  checking: boolean;
  /** The backend itself did not answer — distinct from "Hindsight is down". */
  unreachable: boolean;
  refresh: () => void;
}

/**
 * One probe for the whole app.
 *
 * The shell and the page below it each used to run their own probe, so a freshly
 * opened page could still say "checking" while the header already said
 * "connected". The shell now owns the single probe and shares its verdict; every
 * surface reads the same state, so they can never disagree.
 */
const MemoryHealthContext = createContext<MemoryHealth | null>(null);

export function MemoryHealthProvider({ children }: { children: ReactNode }) {
  const health = useMemoryHealthProbe(30_000, true);
  return createElement(MemoryHealthContext.Provider, { value: health }, children);
}

/**
 * Poll the memory-layer health so the UI can always tell the truth about whether
 * Hindsight is reachable. This is the mechanism that stops any screen implying
 * memory worked when it did not.
 *
 * Inside the app shell this returns the shared verdict. Outside it (a page or
 * component rendered on its own) it runs its own probe with identical semantics.
 */
export function useMemoryHealth(intervalMs = 30_000): MemoryHealth {
  const shared = useContext(MemoryHealthContext);
  const own = useMemoryHealthProbe(intervalMs, shared === null);
  return shared ?? own;
}

function useMemoryHealthProbe(intervalMs: number, enabled: boolean): MemoryHealth {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [availability, setAvailability] = useState<MemoryAvailability>('checking');
  // Which layer failed. Held back until we actually commit to `unavailable`, so a
  // transient blip does not flash "Backend unreachable" in the header either.
  const [failure, setFailure] = useState<'backend' | 'memory' | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // A shared verdict is being used instead; this instance does not probe.
    if (!enabled) return;
    let active = true;
    let confirmTimer: number | undefined;
    let consecutiveFailures = 0;

    const check = async (): Promise<void> => {
      let connected = false;
      let kind: 'backend' | 'memory' = 'memory';

      try {
        const result = await health.memory();
        if (!active) return;
        setStatus(result);
        connected = result.connected;
      } catch {
        if (!active) return;
        kind = 'backend';
      }
      if (!active) return;

      if (connected) {
        consecutiveFailures = 0;
        setFailure(null);
        setAvailability('connected');
        return;
      }

      consecutiveFailures += 1;
      if (consecutiveFailures >= FAILURES_BEFORE_UNAVAILABLE) {
        setFailure(kind);
        setAvailability('unavailable');
        return;
      }

      // First failure: hold the current verdict and confirm quickly, rather than
      // announcing an outage that may not exist.
      window.clearTimeout(confirmTimer);
      confirmTimer = window.setTimeout(() => void check(), CONFIRM_DELAY_MS);
    };

    void check();
    const poll = window.setInterval(() => void check(), intervalMs);

    return () => {
      active = false;
      window.clearInterval(poll);
      window.clearTimeout(confirmTimer);
    };
  }, [intervalMs, nonce, enabled]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    status,
    availability,
    checking: availability === 'checking',
    unreachable: failure === 'backend',
    refresh,
  };
}
