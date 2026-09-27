import { TypeBadge } from './Badges';
import { formatDate } from '../lib/format';
import { scopeLabel } from '../lib/scope';
import type { EvidenceItem } from '../types/api';

/**
 * One recalled memory that informed the recommendation.
 *
 * Every field shown here came back from a Hindsight recall. The backend drops
 * any citation it cannot trace to a recalled memory, so nothing rendered here is
 * generated text.
 */
export function EvidenceCard({ evidence }: { evidence: EvidenceItem }) {
  return (
    <li className="rounded-xl border border-black/[0.07] bg-paper p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <TypeBadge type={evidence.memoryType} />
        {evidence.scope !== 'unknown' && (
          <>
            <span aria-hidden="true" className="text-ink-muted/50">·</span>
            <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-ink-muted">
              {scopeLabel(evidence.scope)}
            </span>
          </>
        )}
      </div>

      <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink">{evidence.statement}</p>

      <p className="mt-2.5 text-xs text-ink-muted">
        {evidence.sourceLabelDisplay && (
          <span className="font-medium text-ink-soft">{evidence.sourceLabelDisplay}</span>
        )}
        {evidence.sourceLabelDisplay && evidence.occurredAt && ' · '}
        {evidence.occurredAt && formatDate(evidence.occurredAt)}
      </p>
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
    <ul className="space-y-2">
      {evidence.map((e) => (
        <EvidenceCard key={e.memoryId} evidence={e} />
      ))}
    </ul>
  );
}
