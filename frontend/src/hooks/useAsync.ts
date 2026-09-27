import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../lib/api';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  errorMessage: string | null;
  reload: () => void;
}

/**
 * Load data on mount and whenever `deps` change.
 *
 * Deliberately a small hook rather than a data-fetching library: ClientOS has a
 * handful of endpoints and simple React state covers it. Requests are aborted on
 * unmount and superseded by later ones, so a slow response cannot overwrite a
 * newer result.
 */
export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean } = {},
): AsyncState<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    loaderRef.current(controller.signal)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (active) setError(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, errorMessage: error ? getErrorMessage(error) : null, reload };
}

export interface MutationState<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult | null>;
  pending: boolean;
  error: unknown;
  errorMessage: string | null;
  reset: () => void;
}

/**
 * One-shot action with pending/error state.
 *
 * `pending` guards the button, which is what prevents double submission from
 * creating duplicate memory.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): MutationState<TArgs, TResult> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const inFlight = useRef(false);

  const actionRef = useRef(action);
  actionRef.current = action;

  const run = useCallback(async (...args: TArgs): Promise<TResult | null> => {
    // Hard guard against a second concurrent submit (double-click).
    if (inFlight.current) return null;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      return await actionRef.current(...args);
    } catch (e) {
      setError(e);
      return null;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, errorMessage: error ? getErrorMessage(error) : null, reset };
}
