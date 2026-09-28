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
import { formatDate, formatSource } from '../lib/format';
import { flattenProjectMemory, splitRelevant } from '../lib/memoryCounts';
import type { Interaction, InteractionSource, SubmitInteractionResult } from '../types/api';

export function ClientWorkspace() {
  const { clientId = '' } = useParams();
  const [lastResult, setLastResult] = useState<SubmitInteractionResult | null>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const { status: health } = useMemoryHealth();

  const clientState = useAsync((s) => clients.get(clientId, s), [clientId]);
  const { activeProject, activeProjectId, setActiveProject } = useActiveProject(
    clientState.data?.projects,
  );

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

  if (clientState.loading) return <LoadingState label="Loading client" />;
  if (clientState.error !== null) {
    return <ErrorState error={clientState.error} onRetry={clientState.reload} />;
  }
  if (!clientState.data) return null;

  const { client, projects: projectList } = clientState.data;
  const memory = projectState.data?.memory;
  const relevant = splitRelevant(flattenProjectMemory(memory));
  const memoryHref = `/clients/${clientId}/memory${activeProject ? `?project=${activeProject.slug}` : ''}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Client workspace</p>
          <h1 className="mt-1 font-display text-2xl tracking-tight text-ink">{client.name}</h1>
          {client.context && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{client.context}</p>
          )}
        </div>
        {activeProject && (
          <Link
            to={`/clients/${clientId}/ai?project=${activeProject.slug}`}
            className="btn-primary shrink-0"
          >
            Ask ClientOS →
          </Link>
        )}
      </header>

      {projectList.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="A project is a stream of work for this client. Feedback and decisions are recorded against it."
          action={
            <button type="button" className="btn-primary" onClick={() => setProjectDialogOpen(true)}>
              + Add the first project
            </button>
          }
        />
      ) : (
        <>
          <ProjectSwitcher
            projects={projectList}
            activeId={activeProjectId}
            onSelect={setActiveProject}
            onAdd={() => setProjectDialogOpen(true)}
          />

          {activeProject && (
            <ClientContextBar
              clientName={client.name}
              projectName={activeProject.name}
              memoryCount={projectState.data?.memoryCount ?? activeProject.memoryCount}
              relevant={projectState.data ? relevant : undefined}
              interactionCount={activeProject.interactionCount}
              memoryConnected={health?.connected ?? false}
              bankId={client.hindsightBankId}
            />
          )}

          {activeProject?.description && (
            <p className="text-sm leading-relaxed text-ink-muted">{activeProject.description}</p>
          )}

          {activeProject && (projectState.data?.openConflicts ?? 0) > 0 && (
            <div className="card border-l-2 border-l-accent bg-accent-soft/30 p-4">
              <p className="eyebrow text-accent">Preference change detected</p>
              <p className="mt-1.5 text-sm font-medium text-ink">
                {projectState.data?.openConflicts} change
                {(projectState.data?.openConflicts ?? 0) === 1 ? '' : 's'} awaiting your confirmation
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                ClientOS has not stored {(projectState.data?.openConflicts ?? 0) === 1 ? 'it' : 'them'} yet —
                it needs to know how widely {(projectState.data?.openConflicts ?? 0) === 1 ? 'it applies' : 'they apply'}.
              </p>
              <Link to={`/clients/${clientId}/ai?project=${activeProject.slug}`} className="btn-primary mt-3">
                Review change →
              </Link>
            </div>
          )}

          {activeProject && projectState.data && projectState.data.openConflicts === 0 && (
            <p className="text-xs text-ink-muted">
              No unresolved preference conflicts for this project.
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
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

            <div className="space-y-6">
              {projectState.loading && <LoadingState label="Loading memory" rows={2} />}
              {projectState.error !== null && (
                <ErrorState
                  error={projectState.error}
                  onRetry={projectState.reload}
                  context="Current preferences could not be loaded."
                />
              )}
              {memory && (
                <>
                  <p className="text-xs leading-relaxed text-ink-muted">
                    What ClientOS currently holds for{' '}
                    <span className="font-medium text-ink-soft">{activeProject?.name}</span> — its
                    own decisions plus {client.name}'s client-wide preferences.
                  </p>
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
                  {memory.outcomes.length > 0 && (
                    <MemoryPanel title="Outcomes" memories={memory.outcomes} emptyLabel="" />
                  )}
                </>
              )}
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
  if (state.loading) return <LoadingState label="Loading history" rows={2} />;
  if (state.error !== null) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data || state.data.interactions.length === 0) {
    return (
      <section>
        <h3 className="eyebrow mb-2.5">Project history</h3>
        <p className="rounded-lg border border-dashed border-black/10 px-3 py-5 text-center text-xs leading-relaxed text-ink-muted">
          No feedback recorded yet.
          <br />
          Add what the client told you and it will appear here.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="eyebrow mb-2.5">Project history</h3>
      <ol className="space-y-2">
        {state.data.interactions.map((i) => (
          <li key={i.id} className="card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">{i.label}</span>
              <span className="text-xs text-ink-muted">
                {formatSource(i.source)} · {formatDate(i.occurredAt)}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{i.content}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <RetainStatusChip status={i.retainStatus} count={i.memoryCount} />
              {i.retainError && <span className="text-reject">{i.retainError}</span>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RetainStatusChip({ status, count }: { status: Interaction['retainStatus']; count: number }) {
  const map: Record<Interaction['retainStatus'], { label: string; className: string }> = {
    retained: {
      label: `${count} memor${count === 1 ? 'y' : 'ies'} stored`,
      className: 'bg-approve-soft text-approve',
    },
    awaiting_confirmation: { label: 'Awaiting your confirmation', className: 'bg-caution-soft text-caution' },
    failed: { label: 'Not stored in memory', className: 'bg-reject-soft text-reject' },
    pending: { label: 'Processing…', className: 'bg-paper-sunken text-ink-muted' },
    not_durable: { label: 'Nothing durable found', className: 'bg-paper-sunken text-ink-muted' },
  };
  const style = map[status];
  return <span className={`rounded px-1.5 py-0.5 font-medium ${style.className}`}>{style.label}</span>;
}
