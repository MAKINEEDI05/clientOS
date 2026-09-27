import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { clients, projects } from '../services/clientos';
import { MemoryCard } from '../components/MemoryCard';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { formatDate } from '../lib/format';
import { MEMORY_TYPE_OPTIONS } from '../data/options';
import type { MemoryItem, MemoryType } from '../types/api';

/**
 * Chronological view of how the client's decisions evolved.
 *
 * Superseded memories stay visible with their replacement linked, which is the
 * visual proof that history is preserved rather than overwritten.
 */
export function MemoryTimeline() {
  const { clientId = '' } = useParams();
  const [typeFilter, setTypeFilter] = useState<MemoryType | 'all'>('all');
  const [showRetired, setShowRetired] = useState(true);

  const clientState = useAsync((s) => clients.get(clientId, s), [clientId]);
  const projectId = clientState.data?.projects[0]?.id ?? '';

  const memoryState = useAsync(
    (s) => projects.memory(projectId, '', s),
    [projectId],
    { enabled: Boolean(projectId) },
  );

  if (clientState.loading) return <LoadingState label="Loading client" />;
  if (clientState.error) return <ErrorState error={clientState.error} onRetry={clientState.reload} />;

  const all = memoryState.data?.memories ?? [];
  const visible = all.filter(
    (m) => (typeFilter === 'all' || m.memoryType === typeFilter) && (showRetired || m.state === 'valid'),
  );
  const groups = groupByMonth(visible);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Memory timeline</p>
        <h1 className="mt-1 font-display text-2xl tracking-tight text-ink">
          {clientState.data?.client.name}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
          How this client's decisions evolved. Superseded preferences remain visible — ClientOS retires
          them from reasoning without erasing the record.
        </p>
        {memoryState.data?.bankId && (
          <p className="mt-1.5 font-mono text-[0.6875rem] text-ink-muted">
            memory bank: {memoryState.data.bankId}
          </p>
        )}
      </header>

      <div className="card flex flex-wrap items-end gap-4 p-3.5">
        <div>
          <label htmlFor="type-filter" className="label">Type</label>
          <select
            id="type-filter"
            className="input min-w-[11rem]"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MemoryType | 'all')}
          >
            <option value="all">All types</option>
            {MEMORY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={showRetired}
            onChange={(e) => setShowRetired(e.target.checked)}
            className="h-4 w-4 accent-[#1f3a5f]"
          />
          Show superseded
        </label>
        <p className="ml-auto pb-2 text-xs tabular-nums text-ink-muted">
          {visible.length} of {all.length} memories
        </p>
      </div>

      {memoryState.loading && <LoadingState label="Loading memory timeline" />}
      {memoryState.error !== null && <ErrorState error={memoryState.error} onRetry={memoryState.reload} />}

      {memoryState.data && all.length === 0 && (
        <EmptyState
          title="No memories yet"
          description="Record a client interaction and ClientOS will extract the durable decisions from it."
        />
      )}

      {memoryState.data && all.length > 0 && visible.length === 0 && (
        <EmptyState title="Nothing matches this filter" description="Try clearing the type filter." />
      )}

      {groups.map(([month, items]) => (
        <section key={month}>
          <h2 className="eyebrow mb-3 border-b border-black/[0.06] pb-1.5">{month}</h2>
          <ol className="space-y-3">
            {items.map((m) => (
              <li key={m.id} className="relative pl-5">
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-4 h-2 w-2 rounded-full ring-2 ring-paper ${
                    m.state === 'valid' ? 'bg-accent' : 'bg-ink-muted/40'
                  }`}
                />
                <span aria-hidden="true" className="absolute left-[3px] top-6 h-full w-px bg-black/[0.07]" />
                <p className="mb-1.5 text-xs text-ink-muted">{formatDate(m.occurredAt)}</p>
                <MemoryCard memory={m} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function groupByMonth(memories: MemoryItem[]): Array<[string, MemoryItem[]]> {
  const map = new Map<string, MemoryItem[]>();
  for (const m of memories) {
    const d = new Date(m.occurredAt);
    const key = Number.isNaN(d.getTime())
      ? 'Undated'
      : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    map.set(key, [...(map.get(key) ?? []), m]);
  }
  return [...map.entries()];
}
