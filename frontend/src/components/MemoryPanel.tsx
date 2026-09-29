import { MemoryCard } from './MemoryCard';
import { EmptyState } from './States';
import { Icon, type IconName } from './Icon';
import type { MemoryItem } from '../types/api';

export type PanelTone = 'neutral' | 'memory' | 'reject' | 'accent' | 'caution';

const TONE: Record<PanelTone, string> = {
  neutral: 'text-ink-soft',
  memory: 'text-memory',
  reject: 'text-reject',
  accent: 'text-accent',
  caution: 'text-caution',
};

/**
 * One group of memories, e.g. "Rejected approaches".
 *
 * A section of a shared surface rather than a stack of cards: the workspace reads
 * as one body of client knowledge, grouped by what kind of decision it is. Colour
 * is carried by the heading and each row's small icon — never by boxes.
 */
export function MemoryPanel({
  title, description, memories, emptyLabel, id, icon, tone = 'neutral', headingHidden = false,
}: {
  title: string;
  description?: string;
  memories: MemoryItem[];
  emptyLabel: string;
  /** Anchor for in-page navigation from the memory summary. */
  id?: string;
  icon?: IconName;
  tone?: PanelTone;
  /** For groups whose entries carry their own label; the heading stays for screen readers. */
  headingHidden?: boolean;
}) {
  const headingId = `panel-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24 px-4 pb-2 pt-4 sm:px-5">
      <div className={headingHidden ? 'sr-only' : 'flex items-center gap-2'}>
        {icon && <Icon name={icon} className={`h-3.5 w-3.5 ${TONE[tone]}`} strokeWidth={2.25} />}
        <h3 id={headingId} className={`text-2xs font-semibold uppercase tracking-[0.08em] ${TONE[tone]}`}>
          {title}
        </h3>
        <span className="text-2xs tabular-nums text-ink-muted">{memories.length}</span>
      </div>
      {description && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>}

      {memories.length === 0 ? (
        <p className="pb-3 pt-2 text-[0.8125rem] text-ink-muted">{emptyLabel}</p>
      ) : (
        <div className="mt-1 divide-y divide-line-soft">
          {memories.map((m) => (
            <MemoryCard key={m.id} memory={m} compact />
          ))}
        </div>
      )}
    </section>
  );
}

export { EmptyState };
