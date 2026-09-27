import { useState } from 'react';
import { Spinner } from './States';
import { formatDate } from '../lib/format';
import type { Conflict, ConflictScope } from '../types/api';

/**
 * Preference-change confirmation.
 *
 * No scope is preselected: the whole point is that a human decides how widely the
 * change applies. The old memory is shown alongside the new statement so the
 * choice is informed, and the copy states that history is preserved either way.
 */
const SCOPE_OPTIONS: Array<{ value: ConflictScope; label: string; detail: string }> = [
  {
    value: 'interaction',
    label: 'Treat as a temporary exception',
    detail: 'Applies to this design direction only. The earlier preference stays in force everywhere.',
  },
  {
    value: 'project',
    label: 'This project',
    detail: 'Applies to this project only. The earlier preference still applies to the client’s other work.',
  },
  {
    value: 'future',
    label: 'All future projects',
    detail: 'Becomes the client’s current preference. The earlier one is retired but kept as history.',
  },
];

export function ConflictCard({
  conflict, onResolve, pending, error,
}: {
  conflict: Conflict;
  onResolve: (resolution: 'new_preference' | 'keep_existing', scope?: ConflictScope) => void;
  pending: boolean;
  error: string | null;
}) {
  const [scope, setScope] = useState<ConflictScope | null>(null);
  const isScopeOnly = conflict.oldMemoryId === null;

  return (
    <section
      aria-labelledby={`conflict-${conflict.id}`}
      className="card border-l-2 border-l-caution bg-caution-soft/25 p-5"
    >
      <p className="eyebrow text-caution">
        {isScopeOnly ? 'Scope confirmation needed' : 'Preference change detected'}
      </p>
      <h3 id={`conflict-${conflict.id}`} className="mt-1.5 font-display text-lg leading-snug text-ink">
        {isScopeOnly ? 'How widely should this apply?' : 'The client has changed their mind'}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{conflict.explanation}</p>

      <dl className="mt-4 space-y-3">
        {!isScopeOnly && (
          <div className="rounded-lg border border-black/[0.07] bg-paper p-3">
            <dt className="eyebrow">Previously remembered</dt>
            <dd className="mt-1 text-sm leading-relaxed text-ink line-through decoration-ink-muted/40">
              {conflict.oldStatement}
            </dd>
          </div>
        )}
        <div className="rounded-lg border border-caution/25 bg-paper p-3">
          <dt className="eyebrow text-caution">
            New{conflict.interactionLabel ? ` — ${conflict.interactionLabel}` : ''}
          </dt>
          <dd className="mt-1 text-sm font-medium leading-relaxed text-ink">{conflict.newStatement}</dd>
        </div>
      </dl>

      <fieldset className="mt-4" disabled={pending}>
        <legend className="eyebrow mb-2">Apply to</legend>
        <div className="space-y-1.5">
          {SCOPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                scope === option.value
                  ? 'border-accent-ring bg-accent-soft'
                  : 'border-black/[0.07] bg-paper hover:bg-paper-sunken'
              }`}
            >
              <input
                type="radio"
                name={`scope-${conflict.id}`}
                value={option.value}
                checked={scope === option.value}
                onChange={() => setScope(option.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#1f3a5f]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{option.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mt-3 text-sm text-reject">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={pending || scope === null}
          onClick={() => scope && onResolve('new_preference', scope)}
        >
          {pending && <Spinner />}
          Confirm change
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => onResolve('keep_existing')}
        >
          Keep existing preference
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        Nothing is deleted. The earlier preference remains on the memory timeline as history whichever
        option you choose.
      </p>
      <p className="mt-1 text-[0.6875rem] text-ink-muted">Detected {formatDate(conflict.createdAt)}</p>
    </section>
  );
}
