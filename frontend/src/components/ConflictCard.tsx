import { useState } from 'react';
import { Spinner } from './States';
import { formatDate } from '../lib/format';
import { scopeLabel } from '../lib/scope';
import type { Conflict, ConflictScope, MemoryItem } from '../types/api';

/**
 * The preference-change decision.
 *
 * Not an error state: the client has changed their mind, and ClientOS needs a
 * human to say how widely that applies before it touches memory. No scope is
 * preselected — guessing is exactly what this step exists to prevent.
 */
function scopeOptions(
  projectName: string | null | undefined,
): Array<{ value: ConflictScope; label: string; detail: string }> {
  const here = projectName ? `“${projectName}”` : 'this project';
  return [
    {
      value: 'interaction',
      label: 'This interaction only',
      detail: 'A one-off exception for this piece of feedback. The earlier preference stays in force everywhere else.',
    },
    {
      value: 'project',
      label: 'This project',
      detail: `Applies to ${here}. The earlier preference still applies to this client's other projects.`,
    },
    {
      value: 'future',
      label: 'All future projects',
      detail: "Applies across this client's future work, beyond the one it came from. The earlier preference is retired from use but kept as history.",
    },
  ];
}

/**
 * The conflict payload carries the old statement but not its provenance. The
 * project's memory list already has that, so we look it up rather than adding an
 * API field — and fall back to showing the statement alone if there is no match
 * (a conflict can be raised against a consolidated memory with no local record).
 */
export function findOldMemory(
  conflict: Conflict,
  memories: MemoryItem[] | undefined,
): MemoryItem | null {
  if (!conflict.oldMemoryRefId || !memories) return null;
  return memories.find((m) => m.id === conflict.oldMemoryRefId) ?? null;
}

export function ConflictCard({
  conflict, onResolve, pending, error, oldMemory, projectName,
}: {
  conflict: Conflict;
  onResolve: (resolution: 'new_preference' | 'keep_existing', scope?: ConflictScope) => void;
  pending: boolean;
  error: string | null;
  /** Provenance for the previous decision, when we hold a record of it. */
  oldMemory?: MemoryItem | null;
  /**
   * The project this conflict was raised on. Shown, never chosen: a conflict
   * already belongs to a project, and how widely the change applies is the
   * separate decision below.
   */
  projectName?: string | null;
}) {
  const [scope, setScope] = useState<ConflictScope | null>(null);
  const isScopeOnly = conflict.oldMemoryId === null;
  const headingId = `conflict-${conflict.id}`;
  const options = scopeOptions(projectName);

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-2xl border border-black/[0.09] bg-paper shadow-card">
      {/* Header */}
      <div className="border-b border-black/[0.06] bg-paper-sunken px-5 py-4 sm:px-6">
        {projectName && (
          <div className="mb-3">
            <p className="eyebrow">Project</p>
            <p className="mt-0.5 text-sm font-medium text-ink">{projectName}</p>
          </div>
        )}
        <h2 id={headingId} className="font-display text-[1.375rem] leading-snug tracking-tight text-ink">
          {isScopeOnly ? 'How widely does this apply?' : 'Client preference changed'}
        </h2>
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-muted">
          {isScopeOnly
            ? 'This feedback may reach beyond the current project. ClientOS will not guess how far — confirm it below.'
            : 'ClientOS spotted that this contradicts an earlier decision. It has stored nothing: how far the change reaches is your call, not its.'}
        </p>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {/* Old → new */}
        <div className="space-y-2">
          {!isScopeOnly && (
            <>
              <DecisionCard
                kind="previous"
                statement={conflict.oldStatement}
                source={oldMemory?.sourceLabelDisplay ?? null}
                occurredAt={oldMemory?.occurredAt ?? null}
                scope={oldMemory ? scopeLabel(oldMemory.scope) : null}
              />
              <p aria-hidden="true" className="py-0.5 text-center text-lg leading-none text-ink-muted/50">↓</p>
            </>
          )}
          <DecisionCard
            kind="new"
            statement={conflict.newStatement}
            source={conflict.interactionLabel}
            occurredAt={conflict.createdAt}
            scope={null}
          />
        </div>

        {/* Why flagged */}
        {conflict.explanation && (
          <div className="mt-5">
            <h3 className="eyebrow">Why ClientOS flagged this</h3>
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-soft">
              {conflict.explanation}
            </p>
          </div>
        )}

        {/* Scope — the primary decision */}
        <fieldset className="mt-6" disabled={pending}>
          <legend className="eyebrow mb-0.5">How far does this change apply?</legend>
          <p className="mb-3 max-w-prose text-xs leading-relaxed text-ink-muted">
            Choose one to continue — nothing is stored until you do. This is the reach of the
            client's decision, which is a different question from which project you happen to be
            working on.
          </p>

          <div role="radiogroup" aria-label="How far does this change apply?" className="space-y-1.5">
            {options.map((option) => {
              const selected = scope === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                    selected
                      ? 'border-accent bg-accent-soft'
                      : 'border-black/[0.08] bg-paper hover:bg-paper-sunken'
                  }`}
                >
                  <input
                    type="radio"
                    name={`scope-${conflict.id}`}
                    value={option.value}
                    checked={selected}
                    onChange={() => setScope(option.value)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#1f3a5f]"
                  />
                  <span className="min-w-0">
                    <span className={`block text-sm font-medium ${selected ? 'text-accent' : 'text-ink'}`}>
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                      {option.detail}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-reject-soft/60 px-3 py-2 text-sm text-reject">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            className="btn-primary w-full sm:w-auto"
            disabled={pending || scope === null}
            onClick={() => scope && onResolve('new_preference', scope)}
          >
            {pending && <Spinner />}
            Apply preference change →
          </button>
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            disabled={pending}
            onClick={() => onResolve('keep_existing')}
          >
            Keep previous preference
          </button>
        </div>

        <p className="mt-3.5 max-w-prose text-xs leading-relaxed text-ink-muted">
          Whichever you choose, the earlier decision is kept. ClientOS marks it superseded or
          retires it from use — it is never deleted, and it stays on the memory timeline.
        </p>
        <p className="mt-1 text-[0.6875rem] text-ink-muted">Detected {formatDate(conflict.createdAt)}</p>
      </div>
    </section>
  );
}

/**
 * One side of the change. The two are distinguished by weight and a muted label,
 * not by alarm colours — this is a preference change, not a failure.
 */
function DecisionCard({
  kind, statement, source, occurredAt, scope,
}: {
  kind: 'previous' | 'new';
  statement: string;
  source: string | null;
  occurredAt: string | null;
  scope: string | null;
}) {
  const isPrevious = kind === 'previous';
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        isPrevious ? 'border-black/[0.07] bg-paper-sunken' : 'border-accent/25 bg-accent-soft/40'
      }`}
    >
      <p className={`eyebrow ${isPrevious ? 'text-ink-muted' : 'text-accent'}`}>
        {isPrevious ? 'Previous decision' : 'New decision'}
      </p>
      <p
        className={`mt-1.5 leading-relaxed ${
          isPrevious
            ? 'text-[0.9375rem] text-ink-muted line-through decoration-ink-muted/35'
            : 'text-base font-medium text-ink'
        }`}
      >
        {statement}
      </p>
      {(source || occurredAt || scope) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
          {source && <span className="font-medium text-ink-soft">{source}</span>}
          {source && occurredAt && <span aria-hidden="true">·</span>}
          {occurredAt && <span>{formatDate(occurredAt)}</span>}
          {scope && <span aria-hidden="true">·</span>}
          {scope && <span>{scope}</span>}
        </p>
      )}
    </div>
  );
}
