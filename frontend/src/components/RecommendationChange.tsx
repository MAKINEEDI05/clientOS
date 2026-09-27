import { Link } from 'react-router-dom';
import { scopeLabel } from '../lib/scope';
import type { ResolveConflictResult } from '../types/api';

/**
 * Why the recommendation is about to change.
 *
 * Built entirely from the resolution the backend returned — the statements, the
 * scope and the superseded memory are real state, not narration.
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
    <section className="card border-l-2 border-l-approve p-4" aria-live="polite">
      <p className="eyebrow text-approve">Client memory updated</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        {superseded
          ? 'A newer client preference now supersedes an earlier one, so the next recommendation will differ.'
          : 'A new client preference was recorded, so the next recommendation will take it into account.'}
      </p>

      <dl className="mt-3.5 space-y-2.5">
        {superseded && (
          <div className="rounded-lg bg-paper-sunken px-3 py-2.5">
            <dt className="eyebrow">Previously</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-ink-muted line-through decoration-ink-muted/40">
              {superseded.statement}
            </dd>
            <dd className="mt-1 text-xs text-ink-muted">
              Kept as history — {superseded.state === 'invalidated' ? 'retired from active use' : 'still applies elsewhere'}
            </dd>
          </div>
        )}
        <div className="rounded-lg border border-approve/20 bg-approve-soft/30 px-3 py-2.5">
          <dt className="eyebrow text-approve">Now</dt>
          <dd className="mt-0.5 text-sm font-medium leading-relaxed text-ink">{newMemory.statement}</dd>
          <dd className="mt-1 text-xs text-ink-soft">
            Applies to: <span className="font-medium">{scopeLabel(newMemory.scope)}</span>
          </dd>
        </div>
      </dl>

      {resolution.warnings.map((w, i) => (
        <p key={i} className="mt-2 text-xs text-caution">{w}</p>
      ))}

      <div className="mt-3.5 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? 'Regenerating…' : 'Generate updated direction'}
        </button>
        <Link to={memoryHref} className="btn-secondary">View memory timeline</Link>
      </div>
    </section>
  );
}
