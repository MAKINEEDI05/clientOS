import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/**
 * Two real outputs side by side: a muted "before" and a memory-backed "after".
 *
 * Purely presentational. It renders exactly the strings it is handed, which is
 * what lets the comparisons built on it stay honest — nothing here can add
 * content of its own.
 */
export interface Pane {
  label: string;
  text: string;
  note?: ReactNode;
  icon?: IconName;
}

export function ComparePanes({
  before, after, divider,
}: {
  before: Pane;
  after: Pane | null;
  /** What sits between the panes on wide screens. */
  divider: 'vs' | 'arrow';
}) {
  return (
    <div className={`relative grid ${after ? 'md:grid-cols-2' : ''}`}>
      <PaneView pane={before} tone="muted" className={after ? 'border-b border-line md:border-b-0 md:border-r' : ''} />
      {after && <PaneView pane={after} tone="memory" />}
      {after && (
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 hidden h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-paper text-[0.625rem] font-semibold uppercase tracking-wide text-ink-muted shadow-card md:grid"
        >
          {divider === 'vs' ? 'vs' : <Icon name="arrow-right" className="h-3.5 w-3.5" />}
        </span>
      )}
    </div>
  );
}

function PaneView({ pane, tone, className = '' }: { pane: Pane; tone: 'muted' | 'memory'; className?: string }) {
  const isMemory = tone === 'memory';
  return (
    <div className={`min-w-0 px-5 py-4 sm:px-6 sm:py-5 ${isMemory ? 'bg-memory-soft/35' : 'bg-paper-sunken/60'} ${className}`}>
      <p className={`eyebrow flex items-center gap-1.5 ${isMemory ? 'text-memory' : ''}`}>
        {pane.icon && <Icon name={pane.icon} className="h-3.5 w-3.5" strokeWidth={2} />}
        {pane.label}
      </p>
      <p
        className={`mt-2 leading-relaxed ${
          isMemory ? 'text-[0.9375rem] text-ink' : 'text-sm text-ink-muted'
        }`}
      >
        {pane.text}
      </p>
      {pane.note && <p className="mt-2.5 text-2xs leading-relaxed text-ink-muted">{pane.note}</p>}
    </div>
  );
}
