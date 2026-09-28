import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync, useMutation } from '../hooks/useAsync';
import { useActiveProject } from '../hooks/useActiveProject';
import { clients, memories as memoriesApi, projects } from '../services/clientos';
import { MemoryCard } from '../components/MemoryCard';
import { ProjectContextSelector } from '../components/ProjectContextSelector';
import { ConfirmDialog } from '../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { ClientAvatar, handleTabListKeyDown } from '../components/ui';
import { MEMORY_TYPE_OPTIONS } from '../data/options';
import { isClient } from '../lib/identity';
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
  const clientData = isClient(clientState.data, clientId) ? clientState.data : null;
  const { activeProject, activeProjectId, setActiveProject } = useActiveProject(clientData?.projects);

  // The project view already returns this project's memories AND the client-wide
  // ones, so the client-wide view is a filter on it rather than another request.
  // Tagged with the project it was loaded for, so a previous project's memories
  // are never listed under the newly selected one while it loads.
  const projectMemoryState = useAsync(
    (s) => projects.memory(activeProjectId, '', s)
      .then((r) => ({ ...r, projectId: activeProjectId })),
    [activeProjectId],
    { enabled: Boolean(activeProjectId) },
  );
  // Every project's memory. Fetched only when asked for — it is never the default.
  const clientMemoryState = useAsync(
    (s) => clients.memory(clientId, s).then((r) => ({ ...r, clientId })),
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

  if (clientState.error !== null) {
    return <ErrorState error={clientState.error} onRetry={clientState.reload} />;
  }
  if (!clientData) {
    return (
      <div className="mx-auto max-w-4xl">
        <LoadingState label="Loading client" />
      </div>
    );
  }

  const source = view === 'all' ? clientMemoryState : projectMemoryState;
  const projectData = projectMemoryState.data?.projectId === activeProjectId ? projectMemoryState.data : null;
  const clientMemoryData = clientMemoryState.data?.clientId === clientId ? clientMemoryState.data : null;
  const sourceData = view === 'all' ? clientMemoryData : projectData;
  const projectScoped = projectData?.memories ?? [];
  const all =
    view === 'all'
      ? clientMemoryData?.memories ?? []
      : view === 'client-wide'
        ? projectScoped.filter((m) => m.project === null)
        : projectScoped;

  const visible = all.filter(
    (m) => (typeFilter === 'all' || m.memoryType === typeFilter) && (showRetired || m.state === 'valid'),
  );
  const groups = groupByMonth(visible);
  const supersededIds = new Set(all.flatMap((m) => m.supersedes.map((s) => s.memoryRefId)));
  const clientName = clientData.client.name;
  const projectList = clientData.projects;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <ClientAvatar name={clientName} size="lg" />
          <div className="min-w-0">
            <h1 className="page-title">{clientName}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Every decision this client has made, in order — including the ones that changed.
            </p>
          </div>
        </div>

        {projectList.length > 0 && (
          <div className="md:shrink-0">
            <ProjectContextSelector
              projects={projectList}
              activeId={activeProjectId}
              onSelect={setActiveProject}
              id="timeline-project-context"
            />
          </div>
        )}
      </header>

      <div className="surface">
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Memory view"
            onKeyDown={handleTabListKeyDown}
            className="segmented self-start"
          >
            {VIEWS.map((v) => {
              const isActive = view === v.value;
              return (
                <button
                  key={v.value}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setView(v.value)}
                  className="segmented-item"
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          {all.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <label htmlFor="type-filter" className="text-xs font-medium text-ink-muted">Type</label>
                <select
                  id="type-filter"
                  className="select min-w-[10rem] py-1.5 text-[0.8125rem]"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as MemoryType | 'all')}
                >
                  <option value="all">All types</option>
                  {MEMORY_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem] text-ink-soft">
                <input
                  type="checkbox"
                  checked={showRetired}
                  onChange={(e) => setShowRetired(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#2d4f86]"
                />
                Show superseded and retired
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 border-t border-line bg-paper-sunken/50 px-4 py-2.5 text-xs leading-relaxed text-ink-muted sm:px-5 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <p className="max-w-2xl">
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
            )}{' '}
            Superseded preferences stay visible — ClientOS retires them from reasoning without
            erasing the record.
          </p>
          {all.length > 0 && (
            <p className="shrink-0 tabular-nums">
              {visible.length} of {all.length} memories
            </p>
          )}
        </div>
      </div>

      {!sourceData && source.error === null && <LoadingState label="Loading memory timeline" />}
      {source.error !== null && <ErrorState error={source.error} onRetry={source.reload} />}

      {sourceData && all.length === 0 && view === 'client-wide' && (
        <EmptyState
          icon="layers"
          title="No client-wide decisions yet"
          description="Nothing has been recorded as applying to every project for this client. A preference becomes client-wide when you confirm that a change applies beyond the project it came from."
        />
      )}

      {sourceData && all.length === 0 && view !== 'client-wide' && (
        <EmptyState
          icon="history"
          title="No memories yet"
          description="Record what the client told you and ClientOS will extract the durable decisions from it. Nothing is invented — if the feedback carries no decision, nothing is stored."
          action={<Link to={`/clients/${clientId}`} className="btn-primary">Add client feedback</Link>}
        />
      )}

      {sourceData && all.length > 0 && visible.length === 0 && (
        <EmptyState title="Nothing matches this filter" description="Try clearing the type filter." />
      )}

      {retire.errorMessage && (
        <ErrorState error={retire.error} context="The memory was not retired." />
      )}

      {sourceData && groups.map(([month, items]) => (
        <section key={month} className="animate-fade-in">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="eyebrow text-ink-soft">{month}</h2>
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
            <span className="text-2xs tabular-nums text-ink-muted">
              {items.length} {items.length === 1 ? 'memory' : 'memories'}
            </span>
          </div>
          <ol className="relative space-y-3 border-l border-line pl-5 sm:ml-1.5 sm:pl-6">
            {items.map((m) => {
              const wasReplaced = supersededIds.has(m.id) || m.supersededBy !== null;
              const current = m.state === 'valid' && !wasReplaced;
              return (
                <li key={m.id} className="relative">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[1.6875rem] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-canvas sm:-left-[1.9375rem] ${
                      current
                        ? 'bg-memory-bright'
                        : m.state === 'superseded'
                          ? 'bg-caution/70'
                          : 'border border-ink-faint bg-canvas'
                    }`}
                  />
                  <MemoryCard
                    memory={m}
                    current={current}
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
              <blockquote className="my-3 rounded-r-md border-l-2 border-line-strong bg-paper-sunken px-3 py-2 text-ink">
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
