import { Link } from 'react-router-dom';
import { scopeLabel } from '../lib/scope';
import { Icon } from './Icon';
import type { ResolveConflictResult } from '../types/api';

/**
 * What actually changed in memory.
 *
 * Every field comes from the resolution the backend returned. The "status" line
 * reports the real state of the previous memory, so the promise that history is
 * preserved is verifiable rather than asserted.
 */
export function ConflictResolved({
  resolution, memoryHref, onDismiss, projectName,
}: {
  resolution: ResolveConflictResult;
  memoryHref: string;
  onDismiss?: () => void;
  /** The project the change was confirmed on, so "this project" is never abstract. */
  projectName?: string | null;
}) {
  const { newMemory, supersededMemory, resolvedScope } = resolution;

  // The user chose to keep the existing preference: nothing was stored.
  if (!newMemory) {
    return (
      <section aria-live="polite" className="surface animate-fade-in px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-ink/[0.06] text-ink-soft">
              <Icon name="history" className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <span className="eyebrow text-ink">Preference kept</span>
          </p>
          {onDismiss && <DismissButton onClick={onDismiss} />}
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
          The earlier preference stays in force{projectName ? ` on ${projectName}` : ''}. Nothing
          was added to this client's memory, and the new feedback remains on the project history
          as an interaction.
        </p>
      </section>
    );
  }

  const supersededState = supersededMemory?.state;
  // Every branch reports what the backend actually did to the old memory. "valid"
  // means the retirement did not complete — said plainly rather than glossed.
  const statusLine =
    supersededState === 'invalidated'
      ? 'Retired from active use — preserved in history'
      : supersededState === 'superseded'
        ? 'Superseded — preserved in history'
        : supersededState === 'valid'
          ? 'Still in force — retirement did not complete'
          : null;

  const scope = resolvedScope ?? newMemory.scope;
  const appliesTo =
    scope === 'interaction'
      ? 'that one piece of feedback only'
      : scope === 'project'
        ? projectName
          ? `${projectName} only`
          : 'this project only'
        : "all of this client's future work";

  return (
    <section aria-live="polite" className="surface animate-fade-in overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-memory-line/70 bg-memory-soft/60 px-5 py-3 sm:px-6">
        <p className="flex items-center gap-2">
          <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-memory text-white">
            <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <span className="eyebrow text-memory">Preference updated</span>
        </p>
        {onDismiss && <DismissButton onClick={onDismiss} />}
      </div>

      <dl className="divide-y divide-line-soft">
        <Row label="New preference">
          <p className="text-[0.9375rem] font-medium leading-relaxed text-ink">{newMemory.statement}</p>
        </Row>

        <Row label="Applies to">
          <p className="text-sm text-ink-soft">
            {scopeLabel(scope)} — {appliesTo}.
          </p>
        </Row>

        {supersededMemory && (
          <>
            <Row label="Previous preference">
              <p className="text-sm leading-relaxed text-ink-muted line-through decoration-ink-faint/70">
                {supersededMemory.statement}
              </p>
            </Row>
            {statusLine && (
              <Row label="Status">
                <p
                  className={`text-sm ${
                    supersededState === 'valid' ? 'font-medium text-caution' : 'text-ink-soft'
                  }`}
                >
                  {statusLine}
                </p>
              </Row>
            )}
          </>
        )}
      </dl>

      <div className="border-t border-line bg-paper-sunken/50 px-5 py-4 sm:px-6">
        {supersededMemory && (
          <p className="mb-3 text-sm leading-relaxed text-ink-soft">
            <span className="font-medium text-ink">Nothing was deleted.</span>{' '}
            Both decisions remain on this client's memory timeline — the earlier one as history,
            the new one as current.
          </p>
        )}
        {resolution.warnings.map((w, i) => (
          <p key={i} className="mb-2 flex gap-1.5 text-xs text-caution">
            <Icon name="alert" className="mt-px h-3.5 w-3.5" />
            <span>{w}</span>
          </p>
        ))}
        <Link to={memoryHref} className="link inline-flex items-center gap-1 text-sm">
          {supersededMemory ? 'See both on the memory timeline' : 'View memory timeline'}
          <Icon name="arrow-right" className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-4 sm:px-6">
      <dt className="eyebrow pt-0.5">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn-ghost btn-sm -my-1 -mr-2 text-ink-muted">
      Dismiss
    </button>
  );
}
