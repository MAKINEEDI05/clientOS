import type { MemoryScope, MemoryState, MemoryType } from '../types/api';

const TYPE_STYLE: Record<MemoryType, { label: string; className: string; mark: string }> = {
  preference:        { label: 'Preference',        className: 'bg-accent-soft text-accent',   mark: '◆' },
  approval:          { label: 'Approval',          className: 'bg-approve-soft text-approve', mark: '✓' },
  rejection:         { label: 'Rejection',         className: 'bg-reject-soft text-reject',   mark: '✕' },
  constraint:        { label: 'Constraint',        className: 'bg-caution-soft text-caution', mark: '▲' },
  decision:          { label: 'Decision',          className: 'bg-accent-soft text-accent',   mark: '●' },
  outcome:           { label: 'Outcome',           className: 'bg-paper-sunken text-ink-soft',mark: '→' },
  preference_change: { label: 'Preference change', className: 'bg-caution-soft text-caution', mark: '⇄' },
};

export function TypeBadge({ type, showMark = true }: { type: MemoryType | 'unknown'; showMark?: boolean }) {
  const style = type === 'unknown'
    ? { label: 'Uncategorised', className: 'bg-paper-sunken text-ink-muted', mark: '·' }
    : TYPE_STYLE[type];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem] font-medium ${style.className}`}
    >
      {showMark && <span aria-hidden="true">{style.mark}</span>}
      {style.label}
    </span>
  );
}

/** The mark alone, for dense evidence lists. */
export function TypeMark({ type }: { type: MemoryType | 'unknown' }) {
  const style = type === 'unknown' ? { mark: '·', className: 'text-ink-muted', label: 'uncategorised' } : TYPE_STYLE[type];
  return (
    <span className={`font-medium ${style.className.split(' ').find((c) => c.startsWith('text-')) ?? ''}`}>
      <span aria-hidden="true">{style.mark}</span>
      <span className="sr-only">{style.label}</span>
    </span>
  );
}

const SCOPE_LABEL: Record<MemoryScope, string> = {
  interaction: 'This interaction only',
  revision: 'This revision',
  project: 'This project',
  client: 'Client-wide',
  future: 'All future projects',
};

export function ScopeBadge({ scope }: { scope: MemoryScope | 'unknown' }) {
  if (scope === 'unknown') return null;
  const broad = scope === 'client' || scope === 'future';
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] font-medium ${
        broad ? 'bg-accent text-white' : 'bg-paper-sunken text-ink-muted'
      }`}
      title={`Scope: ${SCOPE_LABEL[scope]}`}
    >
      {SCOPE_LABEL[scope]}
    </span>
  );
}

export function StateBadge({ state }: { state: MemoryState }) {
  if (state === 'valid') return null;
  const isSuperseded = state === 'superseded';
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] font-medium ${
        isSuperseded ? 'bg-caution-soft text-caution' : 'bg-paper-sunken text-ink-muted line-through'
      }`}
    >
      {isSuperseded ? 'Superseded' : 'Retired'}
    </span>
  );
}

/**
 * Confidence indicator. Deliberately coarse words rather than a percentage:
 * Hindsight's own scores are relative within a query, not absolute confidence,
 * and a false precision here would be misleading.
 */
export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const level = confidence >= 0.85 ? 'Explicit' : confidence >= 0.6 ? 'Clear' : 'Tentative';
  return (
    <span className="text-[0.6875rem] text-ink-muted" title={`Extraction confidence ${confidence.toFixed(2)}`}>
      {level}
    </span>
  );
}
