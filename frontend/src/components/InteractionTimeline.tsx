import { useId, useState } from 'react';
import { Icon } from './Icon';
import { formatDate, formatShortDate, formatSource } from '../lib/format';
import type { Interaction } from '../types/api';

/**
 * The project's feedback history as a compact timeline.
 *
 * Each interaction is one line — label, a one-line excerpt, date — with the full
 * text and what ClientOS did with it one click away. The dot colour is the real
 * retain status of that interaction, so the rail shows at a glance which feedback
 * became memory.
 */
const STATUS: Record<Interaction['retainStatus'], { dot: string; badge: string; label: (n: number) => string }> = {
  retained: {
    dot: 'bg-memory-bright',
    badge: 'badge-memory',
    label: (n) => `${n} memor${n === 1 ? 'y' : 'ies'} stored`,
  },
  awaiting_confirmation: { dot: 'bg-accent', badge: 'badge-accent', label: () => 'Awaiting your confirmation' },
  failed: { dot: 'bg-reject', badge: 'badge-reject', label: () => 'Not stored in memory' },
  pending: { dot: 'border border-ink-faint bg-canvas', badge: 'badge-neutral', label: () => 'Processing…' },
  not_durable: { dot: 'border border-ink-faint bg-canvas', badge: 'badge-neutral', label: () => 'Nothing durable found' },
};

export function InteractionTimeline({ interactions }: { interactions: Interaction[] }) {
  return (
    <ol className="relative">
      {interactions.map((i, index) => (
        <HistoryEvent key={i.id} interaction={i} last={index === interactions.length - 1} />
      ))}
    </ol>
  );
}

function HistoryEvent({ interaction: i, last }: { interaction: Interaction; last: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const status = STATUS[i.retainStatus];

  return (
    <li className="relative pl-5">
      {!last && <span aria-hidden="true" className="absolute bottom-0 left-[4.5px] top-5 w-px bg-line" />}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-[0.9375rem] h-2.5 w-2.5 rounded-full ring-[3px] ring-canvas ${status.dot}`}
      />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="group -mx-1.5 block w-[calc(100%+0.75rem)] rounded-md px-1.5 py-2 text-left transition-colors hover:bg-paper"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[0.8125rem] font-medium text-ink">{i.label}</span>
          <span className="shrink-0 text-2xs tabular-nums text-ink-muted">{formatShortDate(i.occurredAt)}</span>
        </span>
        <span className={`mt-0.5 block text-xs leading-relaxed text-ink-muted ${open ? '' : 'truncate'}`}>
          {i.content}
        </span>
        <span className="sr-only">. {status.label(i.memoryCount)}</span>
      </button>

      {open && (
        <div id={panelId} className="mb-2 animate-fade-in pb-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2 text-2xs text-ink-muted">
            <span className={`badge ${status.badge}`}>{status.label(i.memoryCount)}</span>
            <span className="inline-flex items-center gap-1">
              <Icon name="message" className="h-3 w-3 text-ink-faint" />
              {formatSource(i.source)} · {formatDate(i.occurredAt)}
            </span>
          </div>
          {i.retainError && <p className="mt-1.5 text-xs text-reject">{i.retainError}</p>}
        </div>
      )}
    </li>
  );
}
