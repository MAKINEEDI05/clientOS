import { ActiveBadge, ConfidenceBadge, ScopeBadge, StateBadge, TypeBadge, TypeMark } from './Badges';
import { Icon } from './Icon';
import { formatDate } from '../lib/format';
import { scopeLabel } from '../lib/scope';
import type { MemoryItem } from '../types/api';

/**
 * One remembered decision.
 *
 * A retired or superseded memory is rendered muted but NEVER hidden — preserving
 * history is a product promise, so the UI has to show it.
 *
 * Two presentations: the full card for the timeline, and a compact row for the
 * grouped panels in the workspace, where the group already says what type it is.
 */
export function MemoryCard({
  memory, compact = false, onRetire, onRestore, busy, activeProjectId, current = false,
}: {
  memory: MemoryItem;
  compact?: boolean;
  /**
   * The project currently in context, so a memory owned by a DIFFERENT project
   * can be told apart from one belonging to this one. Only matters in views that
   * span projects; ownership itself always comes from the memory.
   */
  activeProjectId?: string | null;
  onRetire?: (memory: MemoryItem) => void;
  onRestore?: (memory: MemoryItem) => void;
  busy?: boolean;
  /** In force and not replaced by a later decision. Decided by the caller, who can see the others. */
  current?: boolean;
}) {
  const isRetired = memory.state !== 'valid';
  const canRetire = Boolean(onRetire) && memory.state === 'valid';
  const canRestore = Boolean(onRestore) && memory.state === 'invalidated';

  // A client-wide memory belongs to the relationship, not to one project: it is
  // one stored memory shown under every project, never a copy per project.
  const isClientWide = memory.project === null;
  // Only worth saying in a view that spans projects — and deliberately NOT worded
  // "this project", which is what the scope badge means. Ownership and reach are
  // different things and must not read as the same thing.
  const isOtherProject =
    !isClientWide && Boolean(activeProjectId) && memory.project?.id !== activeProjectId;
  // In a compact panel the surrounding context is already one project, so only
  // the memory that reaches beyond it needs naming.
  const ownerLabel = isClientWide
    ? 'All projects'
    : compact
      ? null
      : memory.project?.name ?? null;

  const statementClass = isRetired
    ? 'text-ink-muted line-through decoration-ink-faint/70'
    : 'text-ink';

  if (compact) {
    const showScope = !isClientWide && memory.scope !== 'project';
    return (
      <article className="flex items-start gap-3 py-3">
        <TypeMark type={memory.memoryType} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-relaxed ${statementClass}`}>{memory.statement}</p>
          {(ownerLabel || showScope || isRetired) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {ownerLabel && (
                <span className="badge badge-outline-accent">
                  <Icon name="layers" className="h-3 w-3" />
                  {ownerLabel}
                </span>
              )}
              {showScope && <ScopeBadge scope={memory.scope} />}
              <StateBadge state={memory.state} />
            </div>
          )}
          <Evolution memory={memory} compact />
        </div>
      </article>
    );
  }

  const hasFooter = Boolean(memory.sourceQuote) || canRetire || canRestore;

  return (
    <article className={`surface p-4 transition-colors sm:p-5 ${isRetired ? 'bg-paper-raised shadow-none' : ''}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeBadge type={memory.memoryType} />
        <ScopeBadge scope={memory.scope} />
        <span className="ml-auto flex items-center gap-1.5">
          {current && memory.state === 'valid' && <ActiveBadge />}
          <StateBadge state={memory.state} />
        </span>
      </div>

      <p className={`mt-3 text-[0.9375rem] leading-relaxed ${statementClass}`}>{memory.statement}</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted">
        {ownerLabel && (
          <span
            className={`inline-flex items-center gap-1.5 font-medium ${
              isClientWide ? 'text-accent' : 'text-ink-soft'
            }`}
          >
            <Icon name={isClientWide ? 'layers' : 'folder'} className="h-3.5 w-3.5" />
            {ownerLabel}
            {isOtherProject && (
              <span className="font-normal text-ink-muted"> · another project</span>
            )}
          </span>
        )}
        {memory.sourceLabelDisplay && (
          <>
            <Sep />
            <span className="inline-flex items-center gap-1.5">
              <Icon name="message" className="h-3.5 w-3.5 text-ink-faint" />
              {memory.sourceLabelDisplay}
            </span>
          </>
        )}
        <Sep />
        <span>{formatDate(memory.occurredAt)}</span>
        {memory.confidence !== null && <Sep />}
        <ConfidenceBadge confidence={memory.confidence} />
      </div>

      <Evolution memory={memory} />

      {hasFooter && (
        <div className="mt-3.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-t border-line-soft pt-3">
          {memory.sourceQuote ? (
            <details className="group min-w-0 flex-1">
              <summary className="disclosure">
                <Icon name="chevron-right" className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                What the client said
              </summary>
              <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-[0.8125rem] italic leading-relaxed text-ink-soft">
                “{memory.sourceQuote}”
              </blockquote>
            </details>
          ) : (
            <span />
          )}
          {canRetire && (
            <button
              type="button"
              className="btn-ghost btn-sm -my-1 -mr-1.5 text-ink-muted"
              disabled={busy}
              onClick={() => onRetire?.(memory)}
            >
              <Icon name="archive" className="h-3.5 w-3.5" />
              Retire from active use
            </button>
          )}
          {canRestore && (
            <button
              type="button"
              className="btn-ghost btn-sm -my-1 -mr-1.5"
              disabled={busy}
              onClick={() => onRestore?.(memory)}
            >
              <Icon name="restore" className="h-3.5 w-3.5" />
              Restore to active use
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** What this replaced, or what replaced it. */
function Evolution({ memory, compact = false }: { memory: MemoryItem; compact?: boolean }) {
  const pad = compact ? 'mt-2 px-3 py-2' : 'mt-3.5 px-3.5 py-3';
  return (
    <>
      {memory.supersededBy && (
        <div className={`rounded-lg border border-caution-line bg-caution-soft/50 ${pad}`}>
          <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-caution">
            <Icon name="arrow-right" className="h-3 w-3" strokeWidth={2.25} />
            Replaced by
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{memory.supersededBy.statement}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Applies to: {scopeLabel(memory.supersededBy.scope)}
          </p>
        </div>
      )}

      {memory.supersedes.length > 0 && (
        <div className={`rounded-lg border border-line-soft bg-paper-sunken ${pad}`}>
          {memory.supersedes.map((s) => (
            <div key={s.memoryRefId}>
              <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                <Icon name="history" className="h-3 w-3" strokeWidth={2.25} />
                Replaces
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted line-through decoration-ink-faint/70">
                {s.statement}
              </p>
            </div>
          ))}
          <p className="mt-1.5 text-xs text-ink-muted">Kept as history — nothing was deleted.</p>
        </div>
      )}
    </>
  );
}

function Sep() {
  return <span aria-hidden="true" className="text-ink-faint">·</span>;
}
