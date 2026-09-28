import { useId, useState } from 'react';
import { EvidenceList } from './EvidenceCard';
import { Icon } from './Icon';
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
    <li className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-[0.1875rem] grid h-5 w-5 shrink-0 place-items-center rounded-full ${
            isAvoid ? 'bg-reject-soft text-reject' : 'bg-memory-soft text-memory'
          }`}
        >
          <Icon name={isAvoid ? 'x' : 'check'} className="h-3 w-3" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium leading-relaxed text-ink">
            <span className="sr-only">{isAvoid ? 'Avoid: ' : 'Recommended: '}</span>
            {line.text}
          </p>
          {line.rationale && (
            <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{line.rationale}</p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              className="-ml-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
            >
              <Icon
                name="chevron-right"
                className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
                strokeWidth={2}
              />
              {open ? 'Hide why' : 'Why?'}
            </button>
            <span aria-hidden="true" className="text-ink-faint">·</span>
            <span
              className={`inline-flex items-center gap-1 text-2xs ${
                grounded ? 'font-medium text-memory' : 'text-ink-muted'
              }`}
            >
              {grounded ? `${line.evidence.length} memor${line.evidence.length === 1 ? 'y' : 'ies'}` : 'General practice'}
            </span>
          </div>

          {open && (
            <div id={panelId} className="mt-3 animate-fade-in rounded-lg border border-line-soft bg-paper-sunken p-3.5">
              <p className="eyebrow mb-1.5">Why this recommendation</p>
              <p className="mb-3.5 text-sm leading-relaxed text-ink-soft">{line.why}</p>
              <p className="eyebrow mb-2">Supporting memories</p>
              <EvidenceList evidence={line.evidence} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
