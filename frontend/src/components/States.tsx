import type { ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { Icon, type IconName } from './Icon';

/** Skeleton rows inside one surface — the shape of a list that is on its way. */
export function LoadingState({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="surface divide-y divide-line-soft overflow-hidden">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-4 sm:px-5">
          <div className="skeleton h-3 w-1/3" />
          <div className="skeleton mt-3 h-3 w-4/5" />
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
  title, description, action, icon,
}: { title: string; description?: string; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="surface flex flex-col items-center px-6 py-10 text-center sm:py-12">
      {icon && (
        <span className="mb-3.5 grid h-10 w-10 place-items-center rounded-full border border-line bg-paper-sunken text-ink-muted">
          <Icon name={icon} className="h-[1.125rem] w-[1.125rem]" />
        </span>
      )}
      <p className="section-title">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
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

  const isDatabase = apiError?.code === 'DATABASE_UNAVAILABLE';

  const heading = isMemory
    ? 'Client memory temporarily unavailable'
    : isLlm
      ? 'AI reasoning failed'
      : isDatabase
        ? "Couldn't save"
        : apiError?.code === 'NETWORK'
          ? 'Cannot reach ClientOS'
          : 'Something went wrong';

  // Written for the person, not the operator: what happened, and what is safe.
  const reassurance = isMemory
    ? "We couldn't access this client's memory. Your request was not lost."
    : isLlm
      ? 'The recommendation could not be generated. Your client data is safe.'
      : isDatabase
        ? 'Your change was not saved. Nothing else was affected.'
        : null;

  const tone = isMemory ? 'caution' : 'reject';

  return (
    <div
      role="alert"
      className={`flex animate-fade-in gap-3 rounded-xl border p-4 ${
        tone === 'caution' ? 'border-caution-line bg-caution-soft/50' : 'border-reject-line bg-reject-soft/50'
      }`}
    >
      <Icon
        name="alert"
        className={`mt-0.5 h-4 w-4 ${tone === 'caution' ? 'text-caution' : 'text-reject'}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{heading}</p>
        {reassurance && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{reassurance}</p>}
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>

        {isMemory && (
          <p className="mt-2 text-sm font-medium text-caution">
            No client history was used. ClientOS will not generate a recommendation it cannot ground in memory.
          </p>
        )}
        {isLlm && (
          <p className="mt-2 text-sm text-ink-soft">
            Client memory is unaffected — nothing was added or changed.
          </p>
        )}
        {context && <p className="mt-2 text-xs text-ink-muted">{context}</p>}
        {apiError?.requestId && (
          <p className="mt-2 font-mono text-2xs text-ink-muted">ref {apiError.requestId}</p>
        )}

        {onRetry && (apiError?.isRetryable ?? true) && (
          <button type="button" onClick={onRetry} className="btn-secondary btn-sm mt-3">
            <Icon name="restore" className="h-3.5 w-3.5" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
