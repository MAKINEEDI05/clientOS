import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync, useMutation } from '../hooks/useAsync';
import { useActiveProject } from '../hooks/useActiveProject';
import { useMemoryHealth } from '../hooks/useMemoryHealth';
import { clients, projects } from '../services/clientos';
import { MemoryPanel } from '../components/MemoryPanel';
import { AddInteractionForm } from '../components/AddInteractionForm';
import { AddProjectDialog } from '../components/AddProjectDialog';
import { ProjectSwitcher } from '../components/ProjectSwitcher';
import { FeedbackResult } from '../components/FeedbackResult';
import { ClientContextBar } from '../components/ClientContextBar';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { Icon } from '../components/Icon';
import { ClientAvatar } from '../components/ui';
import { formatDate, formatSource } from '../lib/format';
import { flattenProjectMemory, splitRelevant } from '../lib/memoryCounts';
import { isClient } from '../lib/identity';
import type { Interaction, InteractionSource, SubmitInteractionResult } from '../types/api';

/**
 * Client → project → decision memory.
 *
 * The page is built top-down in that order: who the client is, which of their
 * projects is in context (and what memory that puts in play), then the decisions
 * themselves beside the place new feedback is recorded.
 */
export function ClientWorkspace() {
  const { clientId = '' } = useParams();
  const [lastResult, setLastResult] = useState<SubmitInteractionResult | null>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const { availability: memoryAvailability } = useMemoryHealth();

  const clientState = useAsync((s) => clients.get(clientId, s), [clientId]);
  // Switching client keeps this page mounted, so the previous client's data is
  // still in state until the new one arrives. It is never shown under this URL.
  const clientData = isClient(clientState.data, clientId) ? clientState.data : null;
  const { activeProject, activeProjectId, setActiveProject } = useActiveProject(clientData?.projects);

  const projectState = useAsync(
    (s) => projects.get(activeProjectId, s),
    [activeProjectId],
    { enabled: Boolean(activeProjectId) },
  );
  const interactionsState = useAsync(
    (s) => projects.interactions(activeProjectId, s),
    [activeProjectId],
    { enabled: Boolean(activeProjectId) },
  );

  const submit = useMutation(
    async (input: { label: string; source: InteractionSource; content: string }) => {
      const result = await projects.submitInteraction(activeProjectId, input);
      setLastResult(result);
      projectState.reload();
      interactionsState.reload();
      clientState.reload();
      return result;
    },
  );

  const createProject = useMutation(async (input: { name: string; description?: string }) => {
    const { project } = await clients.createProject(clientId, input);
    setProjectDialogOpen(false);
    await clientState.reload();
    setActiveProject(project.slug);
    return project;
  });

  if (clientState.error !== null) {
    return <ErrorState error={clientState.error} onRetry={clientState.reload} />;
  }
  if (!clientData) return <LoadingState label="Loading client" />;

  const { client, projects: projectList } = clientData;
  // A previous project's detail stays in state until the new one arrives; it is
  // only shown once it is actually the active project's.
  const detail = projectState.data?.project.id === activeProjectId ? projectState.data : null;
  const memory = detail?.memory;
  const relevant = splitRelevant(flattenProjectMemory(memory));
  const openConflicts = detail?.openConflicts ?? 0;
  const memoryHref = `/clients/${clientId}/memory${activeProject ? `?project=${activeProject.slug}` : ''}`;
  const aiHref = `/clients/${clientId}/ai${activeProject ? `?project=${activeProject.slug}` : ''}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <ClientAvatar name={client.name} size="lg" />
          <div className="min-w-0">
            <h1 className="page-title">{client.name}</h1>
            {client.context && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{client.context}</p>
            )}
          </div>
        </div>
        {activeProject && (
          <Link to={aiHref} className="btn-primary shrink-0 self-start">
            <Icon name="compass" className="h-4 w-4" />
            Ask ClientOS
          </Link>
        )}
      </header>

      {projectList.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No projects yet"
          description="A project is a stream of work for this client. Feedback and decisions are recorded against it."
          action={
            <button type="button" className="btn-primary" onClick={() => setProjectDialogOpen(true)}>
              <Icon name="plus" className="h-4 w-4" />
              Add the first project
            </button>
          }
        />
      ) : (
        <>
          {/* ── The project in context, and the memory it puts in play ── */}
          <section aria-label="Project context" className="surface overflow-hidden">
            <div className="border-b border-line px-4 py-3 sm:px-5">
              <ProjectSwitcher
                projects={projectList}
                activeId={activeProjectId}
                onSelect={setActiveProject}
                onAdd={() => setProjectDialogOpen(true)}
              />
            </div>

            {activeProject && (
              <div key={activeProject.id} className="animate-fade-in px-4 py-5 sm:px-5">
                <ClientContextBar
                  clientName={client.name}
                  projectName={activeProject.name}
                  projectDescription={activeProject.description}
                  // The page already heads with the client; the bar leads with the project.
                  showClientName={false}
                  memoryCount={detail?.memoryCount ?? null}
                  relevant={detail ? relevant : undefined}
                  interactionCount={activeProject.interactionCount}
                  memoryAvailability={memoryAvailability}
                  bankId={client.hindsightBankId}
                />
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-line bg-paper-sunken/50 px-4 py-3 sm:px-5 md:flex-row md:items-start md:justify-between md:gap-6">
              <p className="flex max-w-2xl gap-2 text-xs leading-relaxed text-ink-muted">
                <Icon name="shield" className="mt-px h-3.5 w-3.5 text-ink-faint" />
                <span>
                  {projectList.length > 1 ? (
                    <>
                      {projectList.length} projects share {client.name}'s memory. Decisions recorded on a
                      project stay with that project; client-wide decisions can inform any of them.
                      Switching project changes what ClientOS draws on.
                    </>
                  ) : (
                    <>
                      Decisions recorded here stay with this project. Client-wide decisions can inform any
                      of {client.name}'s projects, including ones added later.
                    </>
                  )}
                </span>
              </p>
              {activeProject && detail && openConflicts === 0 && (
                <p className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
                  <Icon name="check" className="h-3.5 w-3.5 text-memory" strokeWidth={2.25} />
                  No unresolved preference conflicts for this project.
                </p>
              )}
            </div>
          </section>

          {activeProject && openConflicts > 0 && (
            <div className="surface flex animate-fade-in flex-col gap-3 border-accent-line bg-accent-soft/40 p-4 sm:flex-row sm:items-center sm:px-5">
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-paper text-accent shadow-card">
                <Icon name="swap" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow text-accent">Preference change detected</p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {openConflicts} change{openConflicts === 1 ? '' : 's'} awaiting your confirmation
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  ClientOS has not stored {openConflicts === 1 ? 'it' : 'them'} yet —
                  it needs to know how widely {openConflicts === 1 ? 'it applies' : 'they apply'}.
                </p>
              </div>
              <Link to={aiHref} className="btn-primary shrink-0">
                Review change
                <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start xl:gap-8">
            {/* ── Decision memory ── */}
            <section aria-labelledby="memory-heading" className="min-w-0">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="memory-heading" className="section-title flex items-center gap-2">
                  <Icon name="layers" className="h-4 w-4 text-memory" />
                  Decision memory
                </h2>
                <Link to={memoryHref} className="link inline-flex items-center gap-1 text-xs">
                  Full timeline
                  <Icon name="arrow-right" className="h-3 w-3" />
                </Link>
              </div>

              {!detail && projectState.error === null && <LoadingState label="Loading memory" rows={3} />}
              {projectState.error !== null && (
                <ErrorState
                  error={projectState.error}
                  onRetry={projectState.reload}
                  context="Current preferences could not be loaded."
                />
              )}
              {memory && (
                <>
                  <p className="mb-3 max-w-prose text-[0.8125rem] leading-relaxed text-ink-muted">
                    What ClientOS holds for{' '}
                    <span className="font-medium text-ink-soft">{activeProject?.name}</span>: its own
                    decisions, plus the ones marked{' '}
                    <span className="font-medium text-ink-soft">All projects</span> that belong to{' '}
                    {client.name} rather than to any single project. Which of them a given
                    recommendation uses depends on the question asked.
                  </p>
                  <div key={activeProjectId} className="surface animate-fade-in divide-y divide-line">
                    <MemoryPanel
                      title="Current preferences"
                      memories={memory.preferences}
                      emptyLabel="No preferences yet — add feedback and ClientOS will extract them."
                    />
                    <MemoryPanel
                      title="Approved"
                      memories={memory.approvals}
                      emptyLabel="Nothing approved yet."
                    />
                    <MemoryPanel
                      title="Rejected approaches"
                      description="ClientOS steers away from these in every recommendation."
                      memories={memory.rejections}
                      emptyLabel="Nothing rejected yet."
                    />
                    {memory.changes.length > 0 && (
                      <MemoryPanel title="Confirmed preference changes" memories={memory.changes} emptyLabel="" />
                    )}
                    {memory.constraints.length > 0 && (
                      <MemoryPanel title="Constraints" memories={memory.constraints} emptyLabel="" />
                    )}
                    {memory.decisions.length > 0 && (
                      <MemoryPanel title="Decisions" memories={memory.decisions} emptyLabel="" />
                    )}
                    {memory.outcomes.length > 0 && (
                      <MemoryPanel title="Outcomes" memories={memory.outcomes} emptyLabel="" />
                    )}
                  </div>
                </>
              )}
            </section>

            {/* ── Record feedback, and what has been recorded ── */}
            <div className="min-w-0 space-y-6">
              <AddInteractionForm
                onSubmit={(input) => void submit.run(input)}
                pending={submit.pending}
                error={submit.errorMessage}
                projectName={activeProject?.name ?? null}
              />

              {lastResult && (
                <FeedbackResult
                  result={lastResult}
                  memoryHref={memoryHref}
                  onDismiss={() => setLastResult(null)}
                />
              )}

              <InteractionHistory state={interactionsState} />
            </div>
          </div>
        </>
      )}

      <AddProjectDialog
        open={projectDialogOpen}
        onClose={() => {
          createProject.reset();
          setProjectDialogOpen(false);
        }}
        onSubmit={(input) => void createProject.run(input)}
        pending={createProject.pending}
        error={createProject.error}
        clientName={client.name}
      />
    </div>
  );
}

function InteractionHistory({
  state,
}: { state: ReturnType<typeof useAsync<{ interactions: Interaction[]; total: number }>> }) {
  const count = state.data?.interactions.length ?? 0;
  return (
    <section aria-labelledby="history-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="history-heading" className="section-title">Project history</h2>
        {!state.loading && count > 0 && (
          <span className="text-xs tabular-nums text-ink-muted">
            {count} interaction{count === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {state.loading ? (
        <LoadingState label="Loading history" rows={2} />
      ) : state.error !== null ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : !state.data || count === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-xs leading-relaxed text-ink-muted">
          No feedback recorded yet.
          <br />
          Add what the client told you and it will appear here.
        </p>
      ) : (
        <ol className="surface divide-y divide-line-soft">
          {state.data.interactions.map((i) => (
            <li key={i.id} className="px-4 py-3.5 sm:px-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-medium text-ink">{i.label}</span>
                <span className="text-xs text-ink-muted">
                  {formatSource(i.source)} · {formatDate(i.occurredAt)}
                </span>
              </div>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">{i.content}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <RetainStatusChip status={i.retainStatus} count={i.memoryCount} />
                {i.retainError && <span className="text-reject">{i.retainError}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RetainStatusChip({ status, count }: { status: Interaction['retainStatus']; count: number }) {
  const map: Record<Interaction['retainStatus'], { label: string; className: string }> = {
    retained: {
      label: `${count} memor${count === 1 ? 'y' : 'ies'} stored`,
      className: 'badge-memory',
    },
    awaiting_confirmation: { label: 'Awaiting your confirmation', className: 'badge-accent' },
    failed: { label: 'Not stored in memory', className: 'badge-reject' },
    pending: { label: 'Processing…', className: 'badge-neutral' },
    not_durable: { label: 'Nothing durable found', className: 'badge-neutral' },
  };
  const style = map[status];
  return <span className={`badge ${style.className}`}>{style.label}</span>;
}
