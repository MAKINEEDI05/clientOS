import { Link } from 'react-router-dom';
import { scopeLabel } from '../lib/scope';
import type { ResolveConflictResult } from '../types/api';

/**
 * Why the direction is about to change.
 *
 * Built entirely from the resolution the backend returned — the statements, the
 * scope and the superseded memory are real state. Nothing here is written for a
 * particular scenario.
 */
export function RecommendationChange({
  resolution, memoryHref, onRegenerate, regenerating,
}: {
  resolution: ResolveConflictResult;
  memoryHref: string;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const newMemory = resolution.newMemory;
  const superseded = resolution.supersededMemory;
  if (!newMemory) return null;

  return (
    <section
      aria-live="polite"
      className="overflow-hidden rounded-2xl border border-approve/25 bg-approve-soft/25"
    >
      <div className="px-5 py-4">
        <p className="eyebrow text-approve">Recommendation updated</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          {superseded
            ? 'A newer client preference changed the direction.'
            : 'A new client preference was recorded and will shape the next direction.'}
        </p>

        <dl className="mt-4 space-y-3">
          {superseded && (
            <div>
              <dt className="eyebrow">Previous</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-muted line-through decoration-ink-muted/40">
                {superseded.statement}
              </dd>
            </div>
          )}
          <div>
            <dt className="eyebrow text-approve">Current</dt>
            <dd className="mt-1 text-[0.9375rem] font-medium leading-relaxed text-ink">
              {newMemory.statement}
            </dd>
            <dd className="mt-1 text-xs text-ink-muted">
              Applies to: {scopeLabel(newMemory.scope)}
            </dd>
          </div>
        </dl>

        {superseded && (
          <p className="mt-3 text-xs leading-relaxed text-ink-muted">
            The previous preference is kept as history —{' '}
            {superseded.state === 'invalidated' ? 'retired from active use' : 'it still applies elsewhere'}.
          </p>
        )}

        {resolution.warnings.map((w, i) => (
          <p key={i} className="mt-2 text-xs text-caution">{w}</p>
        ))}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" className="btn-primary" onClick={onRegenerate} disabled={regenerating}>
            {regenerating ? 'Regenerating…' : 'Generate updated direction'}
          </button>
          <Link
            to={memoryHref}
            className="text-sm font-medium text-accent transition-colors hover:text-accent-ring"
          >
            View memory change →
          </Link>
        </div>
      </div>
    </section>
  );
}
