import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync, useMutation } from '../hooks/useAsync';
import { useActiveProject } from '../hooks/useActiveProject';
import { clients, memories as memoriesApi, projects } from '../services/clientos';
import { MemoryCard } from '../components/MemoryCard';
import { ProjectContextSelector } from '../components/ProjectContextSelector';
import { ConfirmDialog } from '../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { formatDate } from '../lib/format';
import { MEMORY_TYPE_OPTIONS } from '../data/options';
import type { MemoryItem, MemoryType } from '../types/api';

/**
 * How the client's decisions evolved.
 *
 * Superseded memories stay visible with their replacement linked — that is the
 * visible proof that ClientOS preserves history rather than overwriting it.
 *
 * The default view is the active project's own decisions plus the client-wide
 * ones that apply to it: exactly the context a recommendation for that project
 * would draw on. The wider views are opt-in, and never lose project ownership.
 */
type View = 'project' | 'client-wide' | 'all';

const VIEWS: Array<{ value: View; label: string }> = [
  { value: 'project', label: 'This project' },
  { value: 'client-wide', label: 'Client-wide' },
  { value: 'all', label: 'All client memory' },
];

export function MemoryTimeline() {
  const { clientId = '' } = useParams();
  const [view, setView] = useState<View>('project');
  const [typeFilter, setTypeFilter] = useState<MemoryType | 'all'>('all');
  const [showRetired, setShowRetired] = useState(true);
  const [pendingRetire, setPendingRetire] = useState<MemoryItem | null>(null);

  const clientState = useAsync((s) => clients.get(clientId, s), [clientId]);
  const { activeProject, activeProjectId, setActiveProject } = useActiveProject(
    clientState.data?.projects,
  );

  // The project view already returns this project's memories AND the client-wide
  // ones, so the client-wide view is a filter on it rather than another request.
  const projectMemoryState = useAsync(
    (s) => projects.memory(activeProjectId, '', s),
    [activeProjectId],
    { enabled: Boolean(activeProjectId) },
  );
  // Every project's memory. Fetched only when asked for — it is never the default.
  const clientMemoryState = useAsync(
    (s) => clients.memory(clientId, s),
    [clientId],
    { enabled: view === 'all' },
  );

  const retire = useMutation(async (memoryId: string) => {
    const res = await memoriesApi.invalidate(memoryId);
    setPendingRetire(null);
    projectMemoryState.reload();
    clientMemoryState.reload();
    return res;
  });

  const restore = useMutation(async (memoryId: string) => {
    const res = await memoriesApi.restore(memoryId);
    projectMemoryState.reload();
    clientMemoryState.reload();
    return res;
  });

  if (clientState.loading) return <LoadingState label="Loading client" />;
  if (clientState.error !== null) {
    return <ErrorState error={clientState.error} onRetry={clientState.reload} />;
  }

  const source = view === 'all' ? clientMemoryState : projectMemoryState;
  const projectScoped = projectMemoryState.data?.memories ?? [];
  const all =
    view === 'all'
      ? clientMemoryState.data?.memories ?? []
      : view === 'client-wide'
        ? projectScoped.filter((m) => m.project === null)
        : projectScoped;

  const visible = all.filter(
    (m) => (typeFilter === 'all' || m.memoryType === typeFilter) && (showRetired || m.state === 'valid'),
  );
  const groups = groupByMonth(visible);
  const supersededIds = new Set(all.flatMap((m) => m.supersedes.map((s) => s.memoryRefId)));
  const clientName = clientState.data?.client.name;
  const projectList = clientState.data?.projects ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Memory timeline</p>
        <h1 className="mt-1 font-display text-2xl tracking-tight text-ink">{clientName}</h1>

        {projectList.length > 0 && (
          <div className="mt-3">
            <ProjectContextSelector
              projects={projectList}
              activeId={activeProjectId}
              onSelect={setActiveProject}
              id="timeline-project-context"
            />
          </div>
        )}

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {view === 'project' && (
            <>
              Decisions for {activeProject?.name ?? 'this project'}, plus the client-wide ones that
              apply to all of {clientName}'s work. This is the context a recommendation for this
              project draws on.
            </>
          )}
          {view === 'client-wide' && (
            <>
              Decisions that belong to {clientName} rather than to one project. Each is stored
              once and applies to every project.
            </>
          )}
          {view === 'all' && (
            <>
              Every decision recorded for {clientName}, across all projects and labelled by the
              project that decided it. Recommendations never use another project's decisions —
              this view is for looking back.
            </>
          )}
        </p>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Superseded preferences stay visible — ClientOS retires them from reasoning without
          erasing the record.
        </p>
      </header>

      <div role="tablist" aria-label="Memory view" className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => {
          const isActive = view === v.value;
          return (
            <button
              key={v.value}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setView(v.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink-muted hover:bg-paper-sunken hover:text-ink'
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {all.length > 0 && (
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
            Show superseded and retired
          </label>
          <p className="ml-auto pb-2 text-xs tabular-nums text-ink-muted">
            {visible.length} of {all.length} memories
          </p>
        </div>
      )}

      {source.loading && <LoadingState label="Loading memory timeline" />}
      {source.error !== null && <ErrorState error={source.error} onRetry={source.reload} />}

      {source.data && all.length === 0 && view === 'client-wide' && (
        <EmptyState
          title="No client-wide decisions yet"
          description="Nothing has been recorded as applying to every project for this client. A preference becomes client-wide when you confirm that a change applies beyond the project it came from."
        />
      )}

      {source.data && all.length === 0 && view !== 'client-wide' && (
        <EmptyState
          title="No memories yet"
          description="Record what the client told you and ClientOS will extract the durable decisions from it. Nothing is invented — if the feedback carries no decision, nothing is stored."
          action={<Link to={`/clients/${clientId}`} className="btn-primary">Add client feedback</Link>}
        />
      )}

      {source.data && all.length > 0 && visible.length === 0 && (
        <EmptyState title="Nothing matches this filter" description="Try clearing the type filter." />
      )}

      {retire.errorMessage && (
        <ErrorState error={retire.error} context="The memory was not retired." />
      )}

      {groups.map(([month, items]) => (
        <section key={month}>
          <h2 className="eyebrow mb-3 border-b border-black/[0.06] pb-1.5">{month}</h2>
          <ol className="space-y-3">
            {items.map((m) => {
              const wasReplaced = supersededIds.has(m.id) || m.supersededBy !== null;
              return (
                <li key={m.id} className="relative pl-5">
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-4 h-2 w-2 rounded-full ring-2 ring-paper ${
                      m.state === 'valid' ? 'bg-accent' : 'bg-ink-muted/40'
                    }`}
                  />
                  <span aria-hidden="true" className="absolute left-[3px] top-6 h-full w-px bg-black/[0.07]" />
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-ink-muted">{formatDate(m.occurredAt)}</p>
                    {m.state === 'valid' && !wasReplaced && (
                      <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-approve">
                        Current
                      </span>
                    )}
                    {m.state === 'superseded' && (
                      <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-caution">
                        Superseded
                      </span>
                    )}
                    {m.state === 'invalidated' && (
                      <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-muted">
                        Retired
                      </span>
                    )}
                  </div>
                  <MemoryCard
                    memory={m}
                    activeProjectId={activeProjectId}
                    onRetire={setPendingRetire}
                    onRestore={(mem) => void restore.run(mem.id)}
                    busy={retire.pending || restore.pending}
                  />
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <ConfirmDialog
        open={pendingRetire !== null}
        onCancel={() => setPendingRetire(null)}
        onConfirm={() => pendingRetire && void retire.run(pendingRetire.id)}
        title="Retire this memory?"
        confirmLabel={retire.pending ? 'Retiring…' : 'Retire memory'}
        pending={retire.pending}
        body={
          <>
            <p>
              ClientOS will stop treating this as active context, so it will no longer shape
              recommendations.
            </p>
            {pendingRetire && (
              <blockquote className="my-3 border-l-2 border-black/10 pl-3 text-ink">
                {pendingRetire.statement}
              </blockquote>
            )}
            {pendingRetire?.project === null && (
              <p className="mb-3 text-ink-muted">
                This is a client-wide decision, so retiring it affects every project for{' '}
                {clientName}.
              </p>
            )}
            <p className="text-ink-muted">
              It stays on this timeline as history and can be restored at any time. Nothing is
              deleted.
            </p>
          </>
        }
      />
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
