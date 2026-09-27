import { useId, useState } from 'react';
import { EvidenceList } from './EvidenceCard';
import type { RecommendationLine } from '../types/api';

/**
 * One point of direction, with its supporting memories one click away.
 *
 * Visually lighter than the recommendation itself: this is supporting detail,
 * and the page hierarchy depends on it not competing with the headline.
 */
export function RecommendationCard({
  line, variant,
}: { line: RecommendationLine; variant: 'recommend' | 'avoid' }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const isAvoid = variant === 'avoid';
  const grounded = line.evidence.length > 0;

  return (
    <li className="border-b border-black/[0.06] pb-3.5 last:border-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span
          className={`mt-[0.15rem] shrink-0 text-sm font-semibold ${
            isAvoid ? 'text-reject' : 'text-approve'
          }`}
          aria-hidden="true"
        >
          {isAvoid ? '✕' : '✓'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium leading-relaxed text-ink">
            <span className="sr-only">{isAvoid ? 'Avoid: ' : 'Recommended: '}</span>
            {line.text}
          </p>
          {line.rationale && (
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{line.rationale}</p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              className="-ml-1 rounded px-1 py-0.5 text-xs font-medium text-accent transition-colors hover:text-accent-ring"
            >
              {open ? 'Hide why' : 'Why?'}
            </button>
            <span className="text-[0.6875rem] text-ink-muted">
              {grounded
                ? `${line.evidence.length} memor${line.evidence.length === 1 ? 'y' : 'ies'}`
                : 'General practice'}
            </span>
          </div>

          {open && (
            <div id={panelId} className="mt-2.5 rounded-lg bg-paper-sunken p-3">
              <p className="eyebrow mb-1.5">Why this recommendation</p>
              <p className="mb-2.5 text-sm leading-relaxed text-ink-soft">{line.why}</p>
              <p className="eyebrow mb-1.5">Supporting memories</p>
              <EvidenceList evidence={line.evidence} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
