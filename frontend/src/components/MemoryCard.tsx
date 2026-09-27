import { ConfidenceBadge, ScopeBadge, StateBadge, TypeBadge } from './Badges';
import { formatDate } from '../lib/format';
import type { MemoryItem } from '../types/api';

/**
 * One remembered decision. Used on the client workspace and the timeline.
 *
 * A superseded memory is rendered muted but NEVER hidden — the product promise is
 * that history is preserved, and the UI has to show that.
 */
export function MemoryCard({ memory, compact = false }: { memory: MemoryItem; compact?: boolean }) {
  const isRetired = memory.state !== 'valid';

  return (
    <article className={`card p-3.5 ${isRetired ? 'opacity-70' : ''}`}>
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
          {memory.hindsightMemoryId && (
            <span className="font-mono text-[0.625rem]" title="Hindsight memory id">
              {memory.hindsightMemoryId.slice(0, 12)}
            </span>
          )}
        </div>
      )}

      {memory.supersededBy && (
        <p className="mt-2.5 border-l-2 border-caution/40 pl-2.5 text-xs leading-relaxed text-ink-muted">
          <span className="font-medium text-caution">Superseded by:</span> {memory.supersededBy.statement}
          {' '}<span className="text-ink-muted/80">({memory.supersededBy.scope === 'project' ? 'this project only' : memory.supersededBy.scope})</span>
        </p>
      )}

      {memory.supersedes.length > 0 && (
        <div className="mt-2.5 border-l-2 border-accent/30 pl-2.5">
          {memory.supersedes.map((s) => (
            <p key={s.memoryRefId} className="text-xs leading-relaxed text-ink-muted">
              <span className="font-medium text-accent">Replaces:</span>{' '}
              <span className="line-through decoration-ink-muted/50">{s.statement}</span>
            </p>
          ))}
        </div>
      )}

      {memory.sourceQuote && !compact && (
        <details className="mt-2.5 group">
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink-soft">
            Source quote
          </summary>
          <blockquote className="mt-1.5 border-l-2 border-black/10 pl-2.5 text-xs italic leading-relaxed text-ink-soft">
            “{memory.sourceQuote}”
          </blockquote>
        </details>
      )}
    </article>
  );
}
