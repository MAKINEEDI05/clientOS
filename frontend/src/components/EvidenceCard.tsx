import { ScopeBadge, TypeBadge } from './Badges';
import { Icon } from './Icon';
import { MemoryProvenance } from './MemoryProvenance';
import { formatDate } from '../lib/format';
import type { EvidenceItem } from '../types/api';

/**
 * One recalled memory that informed the recommendation.
 *
 * Every field shown here came back from a Hindsight recall. The backend drops
 * any citation it cannot trace to a recalled memory, so nothing rendered here is
 * generated text.
 *
 * The memory's identity and tags sit behind a collapsed disclosure: enough to
 * verify the citation is a real stored memory, never enough to turn the page into
 * a debugging view.
 */
export function EvidenceCard({ evidence }: { evidence: EvidenceItem }) {
  return (
    <li className="flex flex-col rounded-lg border border-line bg-paper px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeBadge type={evidence.memoryType} />
        <ScopeBadge scope={evidence.scope} />
      </div>

      {/* The recalled decision itself, set off by the memory rule. */}
      <p className="mt-2.5 border-l-2 border-memory-line pl-3 text-[0.9375rem] leading-relaxed text-ink">
        {evidence.statement}
      </p>

      {(evidence.sourceLabelDisplay || evidence.occurredAt) && (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
          <Icon name="message" className="h-3.5 w-3.5 text-ink-faint" />
          {evidence.sourceLabelDisplay && (
            <span className="font-medium text-ink-soft">{evidence.sourceLabelDisplay}</span>
          )}
          {evidence.sourceLabelDisplay && evidence.occurredAt && <span aria-hidden="true">·</span>}
          {evidence.occurredAt && <span>{formatDate(evidence.occurredAt)}</span>}
        </p>
      )}

      <div className="pt-3">
        <MemoryProvenance evidence={evidence} />
      </div>
    </li>
  );
}

/** Compact list of evidence, used inside a recommendation's Why disclosure. */
export function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  if (evidence.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-ink-muted">
        No client history applies to this point — it reflects general design practice only.
      </p>
    );
  }
  return (
    <ul className="grid gap-2">
      {evidence.map((e) => (
        <EvidenceCard key={e.memoryId} evidence={e} />
      ))}
    </ul>
  );
}
