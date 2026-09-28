import { Link } from 'react-router-dom';
import { TypeBadge } from './Badges';
import { Icon } from './Icon';
import { scopeLabel, scopeExplainer } from '../lib/scope';
import type { SubmitInteractionResult } from '../types/api';

/**
 * What ClientOS took from a piece of feedback.
 *
 * Shows the raw client statement, then what was understood from it, then where
 * it went. Discards are shown too — that ClientOS is selective is part of the
 * product, not something to hide.
 */
export function FeedbackResult({
  result, memoryHref, onDismiss,
}: {
  result: SubmitInteractionResult;
  memoryHref: string;
  onDismiss: () => void;
}) {
  const stored = result.extracted.filter((c) => c.retained);
  const held = result.extracted.filter((c) => !c.retained);
  const hasConflict = result.conflicts.length > 0;
  const nothingDurable = result.extracted.length === 0;

  const accent = hasConflict
    ? 'bg-accent'
    : stored.length > 0
      ? 'bg-memory'
      : 'bg-ink-faint';

  return (
    <section aria-live="polite" className="surface relative animate-fade-in overflow-hidden">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-0.5 ${accent}`} />
      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow text-ink">Feedback saved</p>
          <button type="button" onClick={onDismiss} className="btn-ghost btn-sm -my-1 -mr-2 text-ink-muted">
            Dismiss
          </button>
        </div>

        <blockquote className="mt-2.5 border-l-2 border-line-strong pl-3 text-sm italic leading-relaxed text-ink-soft">
          “{result.interaction.content}”
        </blockquote>
        <p className="mt-1.5 text-xs text-ink-muted">{result.interaction.label}</p>

        {nothingDurable ? (
          <div className="mt-4 rounded-lg bg-paper-sunken px-3.5 py-3">
            <p className="text-sm font-medium text-ink">No durable client preference was detected.</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              The feedback is kept as an interaction, but nothing was added to this client's memory —
              ClientOS only remembers explicit decisions, not general remarks.
            </p>
          </div>
        ) : (
          <>
            <p className="eyebrow mt-4 flex items-center gap-1.5">
              <Icon name="arrow-down" className="h-3 w-3" strokeWidth={2.25} />
              ClientOS understood
            </p>

            <ul className="mt-2 space-y-2">
              {stored.map((c, i) => (
                <li key={`s-${i}`} className="rounded-lg border border-memory-line bg-memory-soft/40 p-3">
                  <TypeBadge type={c.memoryType} />
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink">{c.statement}</p>
                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    <div>
                      <dt className="inline text-ink-muted">Applies to: </dt>
                      <dd className="inline font-medium text-ink-soft">{scopeLabel(c.scope)}</dd>
                    </div>
                    <div>
                      <dt className="inline text-ink-muted">Source: </dt>
                      <dd className="inline font-medium text-ink-soft">{result.interaction.label}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-memory">
                    <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Stored in client memory
                  </p>
                </li>
              ))}

              {held.map((c, i) => (
                <li key={`h-${i}`} className="rounded-lg border border-accent-line bg-accent-soft/40 p-3">
                  <TypeBadge type={c.memoryType} />
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink">{c.statement}</p>
                  <p className="mt-2 text-xs leading-relaxed text-accent">
                    {hasConflict
                      ? 'Held — this changes an existing preference. Confirm how widely it applies before it is stored.'
                      : 'Held — confirm how widely this applies before it is stored.'}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        {result.discarded.length > 0 && (
          <details className="group mt-3">
            <summary className="disclosure">
              <Icon name="chevron-right" className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
              Not stored ({result.discarded.length})
            </summary>
            <ul className="mt-1.5 space-y-1 pl-4">
              {result.discarded.map((d, i) => (
                <li key={i} className="text-xs leading-relaxed text-ink-muted">
                  {d.text ? <span className="text-ink-soft">“{d.text}” — </span> : null}
                  {d.reason}
                </li>
              ))}
            </ul>
          </details>
        )}

        {result.warnings.map((w, i) => (
          <p key={i} className="mt-2 text-xs text-caution">{w}</p>
        ))}

        {stored.length > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-ink-muted">
            {scopeExplainer(stored[0]?.scope ?? 'project')}
          </p>
        )}

        <div className="mt-3.5 flex flex-wrap gap-2">
          <Link to={memoryHref} className="btn-secondary btn-sm">
            <Icon name="history" className="h-3.5 w-3.5" />
            View memory timeline
          </Link>
        </div>
      </div>
    </section>
  );
}
