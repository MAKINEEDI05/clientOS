import type { MemoryScope, MemoryState, MemoryType } from '../types/api';
import { isBroadScope, scopeExplainer, scopeLabel } from '../lib/scope';
import { Icon, type IconName } from './Icon';

/**
 * Memory vocabulary.
 *
 * Colour is spent only where it carries meaning: approvals share the memory
 * green, rejections are brick, constraints amber, and a preference change takes
 * the blue of a decision someone made. Everything else stays neutral, so a page
 * of preferences does not become a page of colour.
 */
const TYPE_STYLE: Record<MemoryType, { label: string; tone: string; tile: string; text: string; icon: IconName }> = {
  preference:        { label: 'Preference',        tone: 'badge-neutral', tile: 'bg-ink/[0.05] text-ink-soft',  text: 'text-ink-soft', icon: 'bookmark' },
  approval:          { label: 'Approval',          tone: 'badge-memory',  tile: 'bg-memory-soft text-memory',  text: 'text-memory',   icon: 'check' },
  rejection:         { label: 'Rejection',         tone: 'badge-reject',  tile: 'bg-reject-soft text-reject',  text: 'text-reject',   icon: 'x' },
  constraint:        { label: 'Constraint',        tone: 'badge-caution', tile: 'bg-caution-soft text-caution', text: 'text-caution', icon: 'lock' },
  decision:          { label: 'Decision',          tone: 'badge-neutral', tile: 'bg-ink/[0.05] text-ink-soft',  text: 'text-ink-soft', icon: 'flag' },
  outcome:           { label: 'Outcome',           tone: 'badge-neutral', tile: 'bg-ink/[0.05] text-ink-soft',  text: 'text-ink-soft', icon: 'target' },
  preference_change: { label: 'Preference change', tone: 'badge-accent',  tile: 'bg-accent-soft text-accent',  text: 'text-accent',   icon: 'swap' },
};

const UNKNOWN_STYLE = {
  label: 'Uncategorised', tone: 'badge-neutral', tile: 'bg-ink/[0.05] text-ink-muted', text: 'text-ink-muted', icon: 'dot' as IconName,
};

/** Presentation for a memory type — label, colours and icon — from one table. */
export function typeStyle(type: MemoryType | 'unknown') {
  return type === 'unknown' ? UNKNOWN_STYLE : TYPE_STYLE[type];
}

/** Human label for a memory type, so no other component restates these words. */
export function typeLabel(type: MemoryType | 'unknown'): string {
  return type === 'unknown' ? 'Not categorised' : TYPE_STYLE[type].label;
}

export function TypeBadge({ type, showMark = true }: { type: MemoryType | 'unknown'; showMark?: boolean }) {
  const style = type === 'unknown' ? UNKNOWN_STYLE : TYPE_STYLE[type];
  return (
    <span className={`badge ${style.tone}`}>
      {showMark && <Icon name={style.icon} className="h-3 w-3" strokeWidth={2.25} />}
      {style.label}
    </span>
  );
}

/** The type as a small icon tile, for dense lists where a full badge is noise. */
export function TypeMark({ type }: { type: MemoryType | 'unknown' }) {
  const style = type === 'unknown' ? UNKNOWN_STYLE : TYPE_STYLE[type];
  return (
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${style.tile}`}>
      <Icon name={style.icon} className="h-3.5 w-3.5" strokeWidth={2} />
      <span className="sr-only">{typeLabel(type)}</span>
    </span>
  );
}

export function ScopeBadge({ scope }: { scope: MemoryScope | 'unknown' }) {
  if (scope === 'unknown') return null;
  const broad = isBroadScope(scope);
  return (
    <span className={`badge ${broad ? 'badge-outline-accent' : 'badge-outline'}`} title={scopeExplainer(scope)}>
      {scopeLabel(scope)}
    </span>
  );
}

/** Quiet status mark: a dot and a word, not a pill. */
function StatusMark({ tone, children, strike = false }: { tone: string; children: string; strike?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-2xs font-medium ${tone}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      <span className={strike ? 'line-through decoration-current/60' : ''}>{children}</span>
    </span>
  );
}

export function StateBadge({ state }: { state: MemoryState }) {
  if (state === 'valid') return null;
  return state === 'superseded'
    ? <StatusMark tone="text-caution">Superseded</StatusMark>
    : <StatusMark tone="text-ink-muted" strike>Retired</StatusMark>;
}

/** A memory in force and not replaced — the counterpart to Superseded and Retired. */
export function ActiveBadge() {
  return <StatusMark tone="text-memory">Active</StatusMark>;
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
    <span className="text-2xs text-ink-muted" title={`Extraction confidence ${confidence.toFixed(2)}`}>
      {level}
    </span>
  );
}
