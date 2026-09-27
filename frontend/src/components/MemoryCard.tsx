import { ConfidenceBadge, ScopeBadge, StateBadge, TypeBadge } from './Badges';
import { formatDate } from '../lib/format';
import { scopeExplainer, scopeLabel } from '../lib/scope';
import type { MemoryItem } from '../types/api';

/**
 * One remembered decision.
 *
 * A retired or superseded memory is rendered muted but NEVER hidden — preserving
 * history is a product promise, so the UI has to show it.
 */
export function MemoryCard({
  memory, compact = false, onRetire, onRestore, busy,
}: {
  memory: MemoryItem;
  compact?: boolean;
  onRetire?: (memory: MemoryItem) => void;
  onRestore?: (memory: MemoryItem) => void;
  busy?: boolean;
}) {
  const isRetired = memory.state !== 'valid';
  const canRetire = Boolean(onRetire) && memory.state === 'valid';
  const canRestore = Boolean(onRestore) && memory.state === 'invalidated';

  return (
    <article className={`card p-3.5 ${isRetired ? 'opacity-75' : ''}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeBadge type={memory.memoryType} />
        <ScopeBadge scope={memory.scope} />
        <StateBadge state={memory.state} />
      </div>

      <p className={`mt-2 text-sm leading-relaxed text-ink ${isRetired ? 'line-through decoration-ink-muted/50' : ''}`}>
        {memory.statement}
      </p>

      {!compact && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted">
          {memory.sourceLabelDisplay && (
            <span className="font-medium text-ink-soft">{memory.sourceLabelDisplay}</span>
          )}
          <span>{formatDate(memory.occurredAt)}</span>
          <ConfidenceBadge confidence={memory.confidence} />
        </div>
      )}

      {!compact && (
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{scopeExplainer(memory.scope)}</p>
      )}

      {/* Evolution: what this replaced, or what replaced it. */}
      {memory.supersededBy && (
        <div className="mt-3 rounded-lg border border-caution/25 bg-caution-soft/25 p-2.5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-caution">
            Replaced by
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{memory.supersededBy.statement}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Applies to: {scopeLabel(memory.supersededBy.scope)}
          </p>
        </div>
      )}

      {memory.supersedes.length > 0 && (
        <div className="mt-3 rounded-lg border border-black/[0.07] bg-paper-sunken p-2.5">
          {memory.supersedes.map((s) => (
            <div key={s.memoryRefId}>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-muted">
                Replaces
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted line-through decoration-ink-muted/50">
                {s.statement}
              </p>
            </div>
          ))}
          <p className="mt-1.5 text-xs text-ink-muted">Kept as history — nothing was deleted.</p>
        </div>
      )}

      {memory.sourceQuote && !compact && (
        <details className="mt-2.5">
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink-soft">
            What the client said
          </summary>
          <blockquote className="mt-1.5 border-l-2 border-black/10 pl-2.5 text-xs italic leading-relaxed text-ink-soft">
            “{memory.sourceQuote}”
          </blockquote>
        </details>
      )}

      {(canRetire || canRestore) && (
        <div className="mt-3 border-t border-black/[0.06] pt-2.5">
          {canRetire && (
            <button
              type="button"
              className="btn-ghost -ml-2 px-2 py-1 text-xs"
              disabled={busy}
              onClick={() => onRetire?.(memory)}
            >
              Retire from active use
            </button>
          )}
          {canRestore && (
            <button
              type="button"
              className="btn-ghost -ml-2 px-2 py-1 text-xs"
              disabled={busy}
              onClick={() => onRestore?.(memory)}
            >
              Restore to active use
            </button>
          )}
        </div>
      )}
    </article>
  );
}
