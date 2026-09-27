import { MemoryCard } from './MemoryCard';
import { EmptyState } from './States';
import type { MemoryItem } from '../types/api';

/** A grouped panel of memories, e.g. "Rejected approaches". */
export function MemoryPanel({
  title, description, memories, emptyLabel,
}: { title: string; description?: string; memories: MemoryItem[]; emptyLabel: string }) {
  return (
    <section aria-labelledby={`panel-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 id={`panel-${title.replace(/\s+/g, '-').toLowerCase()}`} className="eyebrow">
          {title}
        </h3>
        <span className="text-xs tabular-nums text-ink-muted">{memories.length}</span>
      </div>
      {description && <p className="mb-2.5 text-xs leading-relaxed text-ink-muted">{description}</p>}

      {memories.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/10 px-3 py-4 text-center text-xs text-ink-muted">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-2">
          {memories.map((m) => (
            <MemoryCard key={m.id} memory={m} compact />
          ))}
        </div>
      )}
    </section>
  );
}

export { EmptyState };
