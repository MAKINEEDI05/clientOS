import { ActiveBadge, ConfidenceBadge, StateBadge, typeLabel, typeStyle } from './Badges';
import { Icon } from './Icon';
import { formatDate } from '../lib/format';
import { scopeExplainer, scopeLabel } from '../lib/scope';
import type { MemoryItem } from '../types/api';

/**
 * One remembered decision.
 *
 * A retired or superseded memory is rendered muted but NEVER hidden — preserving
 * history is a product promise, so the UI has to show it.
 *
 * Two presentations: the full entry for the timeline, and a compact row for the
 * grouped decision memory in the workspace, where the group already says what
 * type it is. A memory that replaced an earlier one is shown as a preference
 * change in either — that is the moment ClientOS visibly learns.
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
  const style = typeStyle(memory.memoryType);

  // A client-wide memory belongs to the relationship, not to one project: it is
  // one stored memory shown under every project, never a copy per project.
  const isClientWide = memory.project === null;
  // Only worth saying in a view that spans projects — and deliberately NOT worded
  // "this project", which is what the scope wording means. Ownership and reach are
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
    if (isChange(memory) && !isRetired) return <ChangeEntry memory={memory} isClientWide={isClientWide} />;
    const showScope = !isClientWide && memory.scope !== 'project';
    return (
      <article className="-mx-2 flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-paper-sunken/60">
        <Icon name={style.icon} className={`mt-[0.1875rem] h-4 w-4 ${style.text}`} strokeWidth={2} />
        <span className="sr-only">{typeLabel(memory.memoryType)}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-[0.9375rem] leading-relaxed ${statementClass}`}>{memory.statement}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
            {ownerLabel ? (
              <span className="inline-flex items-center gap-1 font-medium text-accent">
                <Icon name="layers" className="h-3 w-3" />
                {ownerLabel}
              </span>
            ) : (
              <span>Project decision</span>
            )}
            {showScope && <><Sep /><span>{scopeLabel(memory.scope)}</span></>}
            {memory.sourceLabelDisplay && <><Sep /><span>{memory.sourceLabelDisplay}</span></>}
            {memory.occurredAt && <><Sep /><span>{formatDate(memory.occurredAt)}</span></>}
            {isRetired && <><Sep /><StateBadge state={memory.state} /></>}
          </p>
          {memory.supersededBy && <ReplacedBy memory={memory} compact />}
        </div>
      </article>
    );
  }

  const hasFooter = Boolean(memory.sourceQuote) || canRetire || canRestore;

  return (
    <article
      className={`group rounded-lg border px-4 py-3.5 transition-colors sm:px-5 ${
        isRetired
          ? 'border-transparent hover:border-line hover:bg-paper/60'
          : 'border-line bg-paper shadow-card'
      }`}
    >
      {/* The event: which interaction this was extracted from, and when. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
          <Icon name="message" className="h-3.5 w-3.5 text-ink-faint" />
          {memory.sourceLabelDisplay && (
            <span className="font-medium text-ink-soft">{memory.sourceLabelDisplay}</span>
          )}
          {memory.sourceLabelDisplay && <Sep />}
          <span>{formatDate(memory.occurredAt)}</span>
        </p>
        <span className="flex items-center gap-2">
          {current && memory.state === 'valid' && <ActiveBadge />}
          <StateBadge state={memory.state} />
        </span>
      </div>

      <p className={`mt-1.5 text-[0.9375rem] leading-relaxed ${statementClass}`}>{memory.statement}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-muted">
        <span className={`inline-flex items-center gap-1 font-medium ${isRetired ? 'text-ink-muted' : style.text}`}>
          <Icon name={style.icon} className="h-3 w-3" strokeWidth={2.25} />
          {typeLabel(memory.memoryType)}
        </span>
        {memory.scope && (
          <>
            <Sep />
            <span title={scopeExplainer(memory.scope)}>{scopeLabel(memory.scope)}</span>
          </>
        )}
        {ownerLabel && (
          <>
            <Sep />
            <span
              className={`inline-flex items-center gap-1 ${isClientWide ? 'font-medium text-accent' : 'text-ink-soft'}`}
            >
              <Icon name={isClientWide ? 'layers' : 'folder'} className="h-3 w-3" />
              {ownerLabel}
              {isOtherProject && (
                <span className="font-normal text-ink-muted"> · another project</span>
              )}
            </span>
          </>
        )}
        {memory.confidence !== null && <Sep />}
        <ConfidenceBadge confidence={memory.confidence} />
      </div>

      <Lineage memory={memory} />

      {hasFooter && (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-t border-line-soft pt-2.5">
          {memory.sourceQuote ? (
            <details className="group/quote min-w-0 flex-1">
              <summary className="disclosure">
                <Icon name="chevron-right" className="h-3.5 w-3.5 transition-transform group-open/quote:rotate-90" />
                What the client said
              </summary>
              <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-[0.8125rem] italic leading-relaxed text-ink-soft">
                “{memory.sourceQuote}”
              </blockquote>
            </details>
          ) : (
            <span />
          )}
          {/* Revealed on hover where hover exists; always visible on touch and to keyboard focus. */}
          <span className="transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
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
          </span>
        </div>
      )}
    </article>
  );
}

/** A memory that replaced an earlier decision, or is typed as a change of mind. */
function isChange(memory: MemoryItem): boolean {
  return memory.memoryType === 'preference_change' || memory.supersedes.length > 0;
}

/**
 * The preference change, given its own treatment: the new decision, what it
 * replaced, how far it reaches, and that the earlier decision is kept. Every
 * value is the memory's own — the statement is never reworded.
 */
function ChangeEntry({ memory, isClientWide }: { memory: MemoryItem; isClientWide: boolean }) {
  return (
    <article className="my-1.5 rounded-lg border border-accent-line bg-accent-soft/40 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-accent">
          <Icon name="swap" className="h-3.5 w-3.5" strokeWidth={2} />
          Preference changed
        </p>
        <p className="text-2xs text-ink-muted">
          {memory.sourceLabelDisplay}
          {memory.sourceLabelDisplay && memory.occurredAt && ' · '}
          {memory.occurredAt && formatDate(memory.occurredAt)}
        </p>
      </div>

      <p className="mt-2 text-[0.9375rem] font-medium leading-relaxed text-ink">{memory.statement}</p>

      {memory.supersedes.map((s) => (
        <p key={s.memoryRefId} className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">
          <span className="font-medium text-ink-soft">Previously </span>
          <span className="line-through decoration-ink-faint/70">{s.statement}</span>
        </p>
      ))}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-accent-line/60 pt-2.5 text-xs">
        <span>
          <span className="text-ink-muted">Scope </span>
          <span className="font-medium text-ink-soft">{scopeLabel(memory.scope)}</span>
        </span>
        {isClientWide && (
          <span className="inline-flex items-center gap-1 font-medium text-accent">
            <Icon name="layers" className="h-3 w-3" />
            All projects
          </span>
        )}
        {memory.supersedes.length > 0 && (
          <span className="inline-flex items-center gap-1 text-memory">
            <Icon name="history" className="h-3.5 w-3.5" />
            Replaces the previous preference · kept as history
          </span>
        )}
      </div>
    </article>
  );
}

function ReplacedBy({ memory, compact = false }: { memory: MemoryItem; compact?: boolean }) {
  if (!memory.supersededBy) return null;
  return (
    <div className={`rounded-lg border border-caution-line bg-caution-soft/40 ${compact ? 'mt-2 px-3 py-2' : 'mt-3 px-3.5 py-2.5'}`}>
      <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-caution">
        <Icon name="arrow-right" className="h-3 w-3" strokeWidth={2.25} />
        Replaced by
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink">{memory.supersededBy.statement}</p>
      <p className="mt-0.5 text-xs text-ink-muted">Applies to: {scopeLabel(memory.supersededBy.scope)}</p>
    </div>
  );
}

/**
 * Where this decision sits in the chain: what it replaced (earlier) and what
 * replaced it (later), in one compact block. Every relationship and statement is
 * kept; only the framing is shared, so a memory that both replaced one decision
 * and was later replaced itself reads as a single line of history.
 */
function Lineage({ memory }: { memory: MemoryItem }) {
  const replaces = memory.supersedes;
  const replacedBy = memory.supersededBy;
  if (!replacedBy && replaces.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-line-soft bg-paper-sunken/70 px-3.5 py-2.5">
      <dl className="space-y-1.5">
        {replaces.map((s) => (
          <div key={s.memoryRefId} className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
            <dt className="flex items-center gap-1.5 pt-0.5 text-2xs font-semibold uppercase tracking-[0.08em] text-accent">
              <Icon name="swap" className="h-3 w-3" strokeWidth={2.25} />
              Replaces
            </dt>
            <dd className="text-sm leading-relaxed text-ink-muted line-through decoration-ink-faint/70">{s.statement}</dd>
          </div>
        ))}
        {replacedBy && (
          <div className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
            <dt className="flex items-center gap-1.5 pt-0.5 text-2xs font-semibold uppercase tracking-[0.08em] text-caution">
              <Icon name="arrow-right" className="h-3 w-3" strokeWidth={2.25} />
              Replaced by
            </dt>
            <dd className="text-sm leading-relaxed text-ink">
              {replacedBy.statement}
              <span className="ml-1.5 text-xs text-ink-muted">· Applies to: {scopeLabel(replacedBy.scope)}</span>
            </dd>
          </div>
        )}
      </dl>
      {replaces.length > 0 && (
        <p className="mt-1.5 text-xs text-ink-muted">Kept as history — nothing was deleted.</p>
      )}
    </div>
  );
}

function Sep() {
  return <span aria-hidden="true" className="text-ink-faint">·</span>;
}
