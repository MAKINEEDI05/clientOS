import type { ReactNode } from 'react';
import { ApiError } from '../lib/api';

export function LoadingState({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card animate-pulse p-4">
          <div className="h-3 w-1/3 rounded bg-black/[0.07]" />
          <div className="mt-3 h-3 w-4/5 rounded bg-black/[0.05]" />
        </div>
      ))}
    </div>
  );
}

/** Inline spinner for buttons. Decorative, so hidden from assistive tech. */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
      <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z" />
    </svg>
  );
}

export function EmptyState({
  title, description, action,
}: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="font-display text-base text-ink">{title}</p>
      {description && <p className="max-w-md text-sm leading-relaxed text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}

/**
 * Error state that distinguishes a MEMORY failure from an AI failure from
 * everything else, because the product promise depends on not conflating them.
 */
export function ErrorState({
  error, onRetry, context,
}: { error: unknown; onRetry?: () => void; context?: string }) {
  const apiError = error instanceof ApiError ? error : null;
  const isMemory = apiError?.isMemoryFailure ?? false;
  const isLlm = apiError?.isLlmFailure ?? false;

  const heading = isMemory
    ? 'Memory unavailable'
    : isLlm
      ? 'AI unavailable'
      : apiError?.code === 'NETWORK'
        ? 'Cannot reach ClientOS'
        : 'Something went wrong';

  const tone = isMemory ? 'caution' : 'reject';

  return (
    <div
      role="alert"
      className={`card border-l-2 p-4 ${
        tone === 'caution' ? 'border-l-caution bg-caution-soft/40' : 'border-l-reject bg-reject-soft/40'
      }`}
    >
      <p className="text-sm font-semibold text-ink">{heading}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        {error instanceof Error ? error.message : 'An unexpected error occurred.'}
      </p>

      {isMemory && (
        <p className="mt-2 text-sm font-medium text-caution">
          No client history was used. ClientOS will not generate a recommendation it cannot ground in memory.
        </p>
      )}
      {context && <p className="mt-2 text-xs text-ink-muted">{context}</p>}
      {apiError?.requestId && (
        <p className="mt-2 font-mono text-[0.6875rem] text-ink-muted">ref {apiError.requestId}</p>
      )}

      {onRetry && (apiError?.isRetryable ?? true) && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-3">
          Try again
        </button>
      )}
    </div>
  );
}
