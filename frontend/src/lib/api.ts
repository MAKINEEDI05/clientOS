import type { ApiErrorShape, ErrorCode } from '../types/api';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const API = `${BASE}/api`;

/** Error carrying the backend's stable code, so the UI can branch meaningfully. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ApiErrorShape['details'];
  readonly requestId?: string;

  constructor(shape: ApiErrorShape, status: number) {
    super(shape.message);
    this.name = 'ApiError';
    this.code = shape.code;
    this.status = status;
    this.details = shape.details;
    this.requestId = shape.requestId;
  }

  /** Memory failures get their own treatment: never imply history was used. */
  get isMemoryFailure(): boolean {
    return this.code === 'MEMORY_UNAVAILABLE';
  }

  get isLlmFailure(): boolean {
    return this.code === 'LLM_UNAVAILABLE';
  }

  get isRetryable(): boolean {
    return (
      this.code === 'MEMORY_UNAVAILABLE' ||
      this.code === 'LLM_UNAVAILABLE' ||
      this.code === 'DATABASE_UNAVAILABLE' ||
      this.code === 'NETWORK' ||
      this.status >= 500
    );
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/**
 * Single fetch wrapper. Unwraps the { success, data } envelope and turns any
 * failure — including a non-JSON or unexpected response — into an ApiError, so no
 * component ever has to reason about raw responses.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(
      { code: 'NETWORK', message: 'Could not reach the ClientOS server. Check that the backend is running.' },
      0,
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new ApiError(
      { code: res.ok ? 'INTERNAL' : 'NETWORK', message: 'The server returned an unreadable response.' },
      res.status,
    );
  }

  const envelope = payload as { success?: boolean; data?: T; error?: ApiErrorShape };

  if (!res.ok || envelope?.success === false) {
    throw new ApiError(
      envelope?.error ?? { code: 'INTERNAL', message: `Request failed (${res.status}).` },
      res.status,
    );
  }

  if (envelope?.success !== true || envelope.data === undefined) {
    // Tolerate an unexpected shape rather than crashing the view.
    throw new ApiError({ code: 'INTERNAL', message: 'The server returned an unexpected response.' }, res.status);
  }

  return envelope.data;
}

export function getErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
