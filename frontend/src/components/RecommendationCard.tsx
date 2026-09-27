import { useId, useState } from 'react';
import { EvidenceList } from './EvidenceCard';
import type { RecommendationLine } from '../types/api';

/**
 * One recommendation line with its collapsible Why panel.
 *
 * Visual hierarchy is deliberate and follows the brief: the recommendation text
 * is primary, Why is one click away, evidence sits inside Why.
 */
export function RecommendationCard({
  line, variant,
}: { line: RecommendationLine; variant: 'recommend' | 'avoid' }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const isAvoid = variant === 'avoid';
  const grounded = line.evidence.length > 0;

  return (
    <li className={`card overflow-hidden border-l-2 ${isAvoid ? 'border-l-reject' : 'border-l-approve'}`}>
      <div className="p-4">
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 shrink-0 text-sm font-semibold ${isAvoid ? 'text-reject' : 'text-approve'}`}
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
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{line.rationale}</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 pl-6">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className="btn-ghost -ml-2 px-2 py-1 text-xs"
          >
            <span aria-hidden="true" className={`transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
            {open ? 'Hide why' : 'Why?'}
          </button>

          {grounded ? (
            <span className="text-[0.6875rem] text-ink-muted">
              {line.evidence.length} memor{line.evidence.length === 1 ? 'y' : 'ies'}
            </span>
          ) : (
            <span className="text-[0.6875rem] text-ink-muted">General practice</span>
          )}
        </div>
      </div>

      {open && (
        <div id={panelId} className="border-t border-black/[0.06] bg-paper-sunken px-4 py-3.5 pl-10">
          <p className="eyebrow mb-2">Why this recommendation</p>
          <p className="mb-3 text-sm leading-relaxed text-ink-soft">{line.why}</p>
          <p className="eyebrow mb-2">Supporting memories</p>
          <EvidenceList evidence={line.evidence} />
        </div>
      )}
    </li>
  );
}
