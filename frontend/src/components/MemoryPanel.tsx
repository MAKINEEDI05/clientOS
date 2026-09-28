import { MemoryCard } from './MemoryCard';
import { EmptyState } from './States';
import type { MemoryItem } from '../types/api';

/**
 * One group of memories, e.g. "Rejected approaches".
 *
 * Rendered as a section of a shared surface rather than a stack of cards: the
 * workspace reads as one body of client knowledge, grouped, not as a card pile.
 */
export function MemoryPanel({
  title, description, memories, emptyLabel,
}: { title: string; description?: string; memories: MemoryItem[]; emptyLabel: string }) {
  const id = `panel-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="px-4 pb-1 pt-4 sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={id} className="eyebrow">{title}</h3>
        <span className="text-xs tabular-nums text-ink-muted">{memories.length}</span>
      </div>
      {description && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>}

      {memories.length === 0 ? (
        <p className="pb-4 pt-2.5 text-[0.8125rem] text-ink-muted">{emptyLabel}</p>
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
