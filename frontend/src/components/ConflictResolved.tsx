import { Link } from 'react-router-dom';
import { scopeLabel } from '../lib/scope';
import type { ResolveConflictResult } from '../types/api';

/**
 * What actually changed in memory.
 *
 * Every field comes from the resolution the backend returned. The "status" line
 * reports the real state of the previous memory, so the promise that history is
 * preserved is verifiable rather than asserted.
 */
export function ConflictResolved({
  resolution, memoryHref, onDismiss,
}: {
  resolution: ResolveConflictResult;
  memoryHref: string;
  onDismiss?: () => void;
}) {
  const { newMemory, supersededMemory, resolvedScope } = resolution;

  // The user chose to keep the existing preference: nothing was stored.
  if (!newMemory) {
    return (
      <section aria-live="polite" className="rounded-2xl border border-black/[0.08] bg-paper px-5 py-4 shadow-card sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow">Preference kept</p>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="btn-ghost -mr-2 -mt-1 px-2 py-0.5 text-xs">
              Dismiss
            </button>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          The earlier preference stays in force. Nothing was added to this client's memory, and
          the new feedback remains on the project history as an interaction.
        </p>
      </section>
    );
  }

  const supersededState = supersededMemory?.state;
  const statusLine =
    supersededState === 'invalidated'
      ? 'Retired from active use — preserved in history'
      : supersededState === 'superseded'
        ? 'Superseded — preserved in history'
        : null;

  return (
    <section
      aria-live="polite"
      className="overflow-hidden rounded-2xl border border-approve/25 bg-paper shadow-card"
    >
      <div className="border-b border-approve/20 bg-approve-soft/40 px-5 py-3.5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow text-approve">Preference updated</p>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="btn-ghost -mr-2 -mt-1 px-2 py-0.5 text-xs">
              Dismiss
            </button>
          )}
        </div>
      </div>

      <dl className="divide-y divide-black/[0.06]">
        <Row label="New preference">
          <p className="text-[0.9375rem] font-medium leading-relaxed text-ink">{newMemory.statement}</p>
        </Row>

        <Row label="Scope">
          <p className="text-sm text-ink-soft">
            {scopeLabel(resolvedScope ?? newMemory.scope)}
          </p>
        </Row>

        {supersededMemory && (
          <>
            <Row label="Previous preference">
              <p className="text-sm leading-relaxed text-ink-muted line-through decoration-ink-muted/35">
                {supersededMemory.statement}
              </p>
            </Row>
            {statusLine && (
              <Row label="Status">
                <p className="text-sm text-ink-soft">{statusLine}</p>
              </Row>
            )}
          </>
        )}
      </dl>

      <div className="px-5 py-4 sm:px-6">
        {resolution.warnings.map((w, i) => (
          <p key={i} className="mb-2 text-xs text-caution">{w}</p>
        ))}
        <Link
          to={memoryHref}
          className="text-sm font-medium text-accent transition-colors hover:text-accent-ring"
        >
          View memory timeline →
        </Link>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[9rem_1fr] sm:gap-4 sm:px-6">
      <dt className="eyebrow pt-0.5">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
