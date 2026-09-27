import { ScopeBadge, TypeBadge } from './Badges';
import { formatDate } from '../lib/format';
import type { EvidenceItem } from '../types/api';

/**
 * One piece of evidence behind a recommendation.
 *
 * Every field shown here came back from a Hindsight recall. The backend drops any
 * citation it cannot trace to a recalled memory, so nothing rendered here is
 * generated text.
 */
export function EvidenceCard({ evidence }: { evidence: EvidenceItem }) {
  return (
    <li className="rounded-lg border border-black/[0.07] bg-paper-raised p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeBadge type={evidence.memoryType} />
        <ScopeBadge scope={evidence.scope} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink">{evidence.statement}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 text-xs text-ink-muted">
        {evidence.sourceLabelDisplay && (
          <span className="font-medium text-ink-soft">{evidence.sourceLabelDisplay}</span>
        )}
        {evidence.occurredAt && <span>{formatDate(evidence.occurredAt)}</span>}
        <span className="font-mono text-[0.625rem]" title="Hindsight memory id">
          {evidence.memoryId.slice(0, 12)}
        </span>
      </div>
    </li>
  );
}

/** Compact list of evidence, used inside the Why panel. */
export function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  if (evidence.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-ink-muted">
        No client history applies to this point — it reflects general design practice only.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {evidence.map((e) => (
        <EvidenceCard key={e.memoryId} evidence={e} />
      ))}
    </ul>
  );
}
