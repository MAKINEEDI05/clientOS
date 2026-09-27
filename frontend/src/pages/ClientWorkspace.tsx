import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync, useMutation } from '../hooks/useAsync';
import { clients, projects } from '../services/clientos';
import { MemoryPanel } from '../components/MemoryPanel';
import { AddInteractionForm } from '../components/AddInteractionForm';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { formatDate, formatSource } from '../lib/format';
import type { Interaction, InteractionSource, SubmitInteractionResult } from '../types/api';

export function ClientWorkspace() {
  const { clientId = '' } = useParams();
  const [lastResult, setLastResult] = useState<SubmitInteractionResult | null>(null);

  const clientState = useAsync((s) => clients.get(clientId, s), [clientId]);
  const activeProjectId = clientState.data?.projects[0]?.id ?? '';

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

  const submit = useMutation(async (input: { label: string; source: InteractionSource; content: string }) => {
    const result = await projects.submitInteraction(activeProjectId, input);
    setLastResult(result);
    projectState.reload();
    interactionsState.reload();
    return result;
  });

  if (clientState.loading) return <LoadingState label="Loading client" />;
  if (clientState.error) return <ErrorState error={clientState.error} onRetry={clientState.reload} />;
  if (!clientState.data) return null;

  const { client, projects: projectList } = clientState.data;
  const memory = projectState.data?.memory;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Client workspace</p>
          <h1 className="mt-1 font-display text-2xl tracking-tight text-ink">{client.name}</h1>
          {client.context && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{client.context}</p>
          )}
          <p className="mt-1.5 font-mono text-[0.6875rem] text-ink-muted">
            memory bank: {client.hindsightBankId}
          </p>
        </div>
        <Link to={`/clients/${clientId}/ai`} className="btn-primary shrink-0">
          Ask ClientOS →
        </Link>
      </header>

      {projectList.length === 0 && (
        <EmptyState title="No projects yet" description="This client has no projects to work on." />
      )}

      {projectList.length > 0 && (
        <>
          <section className="card p-4">
            <p className="eyebrow">Active project</p>
            <h2 className="mt-1 font-display text-lg text-ink">{projectList[0]?.name}</h2>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-black/[0.06] pt-3 text-sm">
              <Stat label="Memories" value={projectState.data?.memoryCount ?? projectList[0]?.memoryCount ?? 0} />
              <Stat label="Interactions" value={projectList[0]?.interactionCount ?? 0} />
              <Stat label="Awaiting confirmation" value={projectState.data?.openConflicts ?? 0} />
            </dl>
            {(projectState.data?.openConflicts ?? 0) > 0 && (
              <Link to={`/clients/${clientId}/ai`} className="btn-secondary mt-3">
                Review {projectState.data?.openConflicts} preference change
                {(projectState.data?.openConflicts ?? 0) === 1 ? '' : 's'}
              </Link>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-6">
              <AddInteractionForm
                onSubmit={(input) => void submit.run(input)}
                pending={submit.pending}
                error={submit.errorMessage}
                lastResult={lastResult}
              />
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
                  <MemoryPanel
                    title="Current preferences"
                    memories={memory.preferences}
                    emptyLabel="No preferences recorded yet."
                  />
                  <MemoryPanel
                    title="Approved"
                    memories={memory.approvals}
                    emptyLabel="Nothing approved yet."
                  />
                  <MemoryPanel
                    title="Rejected approaches"
                    description="ClientOS will steer away from these in every recommendation."
                    memories={memory.rejections}
                    emptyLabel="Nothing rejected yet."
                  />
                  {memory.changes.length > 0 && (
                    <MemoryPanel
                      title="Confirmed preference changes"
                      memories={memory.changes}
                      emptyLabel=""
                    />
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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-lg tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function InteractionHistory({
  state,
}: { state: ReturnType<typeof useAsync<{ interactions: Interaction[]; total: number }>> }) {
  if (state.loading) return <LoadingState label="Loading history" rows={2} />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data || state.data.interactions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-black/10 px-3 py-4 text-center text-xs text-ink-muted">
        No interactions recorded yet.
      </p>
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
    retained: { label: `${count} memor${count === 1 ? 'y' : 'ies'} stored`, className: 'bg-approve-soft text-approve' },
    awaiting_confirmation: { label: 'Awaiting your confirmation', className: 'bg-caution-soft text-caution' },
    failed: { label: 'Not stored in memory', className: 'bg-reject-soft text-reject' },
    pending: { label: 'Processing…', className: 'bg-paper-sunken text-ink-muted' },
    not_durable: { label: 'Nothing durable found', className: 'bg-paper-sunken text-ink-muted' },
  };
  const style = map[status];
  return <span className={`rounded px-1.5 py-0.5 font-medium ${style.className}`}>{style.label}</span>;
}
