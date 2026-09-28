import { useState } from 'react';
import { Spinner } from './States';
import { Icon, type IconName } from './Icon';
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
): Array<{ value: ConflictScope; label: string; detail: string; icon: IconName }> {
  const here = projectName ? `“${projectName}”` : 'this project';
  return [
    {
      value: 'interaction',
      label: 'This interaction only',
      detail: 'A one-off exception for this piece of feedback. The earlier preference stays in force everywhere else.',
      icon: 'message',
    },
    {
      value: 'project',
      label: 'This project',
      detail: `Applies to ${here}. The earlier preference still applies to this client's other projects.`,
      icon: 'folder',
    },
    {
      value: 'future',
      label: 'All future projects',
      detail: "Applies across this client's future work, beyond the one it came from. The earlier preference is retired from use but kept as history.",
      icon: 'layers',
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
    <section aria-labelledby={headingId} className="surface animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="border-b border-line bg-accent-soft/40 px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="badge badge-accent">
            <Icon name="swap" className="h-3 w-3" strokeWidth={2.25} />
            Awaiting your decision
          </span>
          <p className="text-2xs text-ink-muted">Detected {formatDate(conflict.createdAt)}</p>
        </div>

        <h2 id={headingId} className="mt-3 font-display text-[1.375rem] font-medium leading-snug tracking-[-0.01em] text-ink">
          {isScopeOnly ? 'How widely does this apply?' : 'Client preference changed'}
        </h2>
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-muted">
          {isScopeOnly
            ? 'This feedback may reach beyond the current project. ClientOS will not guess how far — confirm it below.'
            : 'ClientOS spotted that this contradicts an earlier decision. It has stored nothing: how far the change reaches is your call, not its.'}
        </p>

        {projectName && (
          <div className="mt-3 flex items-center gap-2">
            <Icon name="folder" className="h-3.5 w-3.5 text-ink-muted" />
            <p className="eyebrow">Project</p>
            <p className="min-w-0 truncate text-[0.8125rem] font-medium text-ink">{projectName}</p>
          </div>
        )}
      </div>

      <div className="px-5 py-5 sm:px-6">
        {/* Old → new */}
        {isScopeOnly ? (
          <DecisionCard
            kind="new"
            statement={conflict.newStatement}
            source={conflict.interactionLabel}
            occurredAt={conflict.createdAt}
            scope={null}
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-3">
            <DecisionCard
              kind="previous"
              statement={conflict.oldStatement}
              source={oldMemory?.sourceLabelDisplay ?? null}
              occurredAt={oldMemory?.occurredAt ?? null}
              scope={oldMemory ? scopeLabel(oldMemory.scope) : null}
            />
            <span aria-hidden="true" className="flex items-center justify-center text-ink-faint">
              <Icon name="arrow-down" className="h-4 w-4 md:hidden" />
              <Icon name="arrow-right" className="hidden h-4 w-4 md:block" />
            </span>
            <DecisionCard
              kind="new"
              statement={conflict.newStatement}
              source={conflict.interactionLabel}
              occurredAt={conflict.createdAt}
              scope={null}
            />
          </div>
        )}

        {/* Why flagged */}
        {conflict.explanation && (
          <div className="mt-4 flex gap-2.5 rounded-lg bg-paper-sunken px-3.5 py-3">
            <Icon name="info" className="mt-0.5 h-4 w-4 text-ink-muted" />
            <div className="min-w-0">
              <h3 className="eyebrow">Why ClientOS flagged this</h3>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">{conflict.explanation}</p>
            </div>
          </div>
        )}

        {/* Scope — the primary decision */}
        <fieldset className="mt-6" disabled={pending}>
          <legend className="section-title">How far does this change apply?</legend>
          <p className="mb-3 mt-1 max-w-prose text-[0.8125rem] leading-relaxed text-ink-muted">
            Choose one to continue — nothing is stored until you do. This is the reach of the
            client's decision, which is a different question from which project you happen to be
            working on.
          </p>

          <div role="radiogroup" aria-label="How far does this change apply?" className="grid gap-2 md:grid-cols-3">
            {options.map((option) => {
              const selected = scope === option.value;
              return (
                <label
                  key={option.value}
                  className={`relative flex cursor-pointer flex-col rounded-lg border p-3.5 transition-[background-color,border-color,box-shadow] duration-150 ${
                    selected
                      ? 'border-accent bg-accent-soft/60 shadow-[0_0_0_1px_#2d4f86]'
                      : 'border-line-strong bg-paper hover:border-ink-faint hover:bg-paper-raised'
                  } ${pending ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name={`scope-${conflict.id}`}
                      value={option.value}
                      checked={selected}
                      onChange={() => setScope(option.value)}
                      className="h-4 w-4 shrink-0 accent-[#2d4f86]"
                    />
                    <span className={`min-w-0 flex-1 text-sm font-medium ${selected ? 'text-accent' : 'text-ink'}`}>
                      {option.label}
                    </span>
                    <Icon
                      name={option.icon}
                      className={`h-4 w-4 ${selected ? 'text-accent' : 'text-ink-faint'}`}
                    />
                  </span>
                  <span className="mt-1.5 block pl-[1.625rem] text-xs leading-relaxed text-ink-muted">
                    {option.detail}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-reject-line bg-reject-soft/60 px-3 py-2 text-sm text-reject">
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-line bg-paper-sunken/50 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            className="btn-primary w-full sm:w-auto"
            disabled={pending || scope === null}
            onClick={() => scope && onResolve('new_preference', scope)}
          >
            {pending && <Spinner />}
            Apply preference change
            {!pending && <Icon name="arrow-right" className="h-4 w-4" />}
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
        <p className="mt-3 flex max-w-prose gap-2 text-xs leading-relaxed text-ink-muted">
          <Icon name="history" className="mt-px h-3.5 w-3.5 text-ink-faint" />
          <span>
            Whichever you choose, the earlier decision is kept. ClientOS marks it superseded or
            retires it from use — it is never deleted, and it stays on the memory timeline.
          </span>
        </p>
      </div>
    </section>
  );
}

/**
 * One side of the change. The two are distinguished by weight and a muted label,
 * not by alarm colours — this is a preference change, not a failure. The earlier
 * decision is not struck through: until someone chooses, it is still in force.
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
      className={`flex flex-col rounded-lg border px-4 py-3.5 ${
        isPrevious ? 'border-line bg-paper-sunken/70' : 'border-accent-line bg-paper shadow-card'
      }`}
    >
      <p className={`eyebrow ${isPrevious ? 'text-ink-muted' : 'text-accent'}`}>
        {isPrevious ? 'Previous decision' : 'New decision'}
      </p>
      <p
        className={`mt-1.5 flex-1 leading-relaxed ${
          isPrevious ? 'text-[0.9375rem] text-ink-soft' : 'text-[0.9375rem] font-medium text-ink'
        }`}
      >
        {statement}
      </p>
      {(source || occurredAt || scope) && (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
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
