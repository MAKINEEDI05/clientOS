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
import { MemoryStatus } from '../components/MemoryStatus';
import { InteractionTimeline } from '../components/InteractionTimeline';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { Icon, type IconName } from '../components/Icon';
import { ClientIdentity } from '../components/ui';
import type { PanelTone } from '../components/MemoryPanel';
import { formatShortDate } from '../lib/format';
import { flattenProjectMemory, splitRelevant } from '../lib/memoryCounts';
import { isClient } from '../lib/identity';
import type { InteractionSource, ProjectDetail, SubmitInteractionResult } from '../types/api';

/**
 * Client → project → decision memory.
 *
 * The page is built top-down in that order: who the client is, which of their
 * projects is in context (and what memory that puts in play), then the decisions
 * themselves — the star of the page — beside the place new feedback is recorded
 * and the history it came from.
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
  // Tagged with its project, so a reload keeps the list on screen and a project
  // switch never shows the previous project's history under the new name.
  const interactionsState = useAsync(
    (s) => projects.interactions(activeProjectId, s).then((r) => ({ ...r, projectId: activeProjectId })),
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
  const history = interactionsState.data?.projectId === activeProjectId ? interactionsState.data : null;
  // The most recent feedback actually recorded on this project, if any.
  const lastFeedbackAt = history?.interactions.reduce<string | null>(
    (latest, i) => (latest === null || i.occurredAt > latest ? i.occurredAt : latest),
    null,
  ) ?? null;
  const memoryHref = `/clients/${clientId}/memory${activeProject ? `?project=${activeProject.slug}` : ''}`;
  const aiHref = `/clients/${clientId}/ai${activeProject ? `?project=${activeProject.slug}` : ''}`;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* ── Who, and which project ── */}
      <header>
        <div className="flex items-center justify-between gap-4">
          <ClientIdentity name={client.name} context={client.context} as="h1" />
          {activeProject && (
            <Link to={aiHref} className="btn-primary shrink-0">
              <Icon name="compass" className="h-4 w-4" />
              Ask ClientOS
            </Link>
          )}
        </div>

        {activeProject && (
          <div key={activeProject.id} className="mt-3 animate-fade-in">
            <h2 className="font-display text-[1.625rem] font-medium leading-tight tracking-[-0.015em] text-ink sm:text-[1.875rem]">
              {activeProject.name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-ink-muted">
              {activeProject.description && (
                <>
                  <span>{activeProject.description}</span>
                  <span aria-hidden="true" className="text-ink-faint">·</span>
                </>
              )}
              <span>
                {activeProject.interactionCount} interaction{activeProject.interactionCount === 1 ? '' : 's'}
              </span>
              {lastFeedbackAt && (
                <>
                  <span aria-hidden="true" className="text-ink-faint">·</span>
                  <span>Last feedback {formatShortDate(lastFeedbackAt)}</span>
                </>
              )}
            </p>
          </div>
        )}

        {projectList.length > 0 && (
          <div className="mt-4">
            <ProjectSwitcher
              projects={projectList}
              activeId={activeProjectId}
              onSelect={setActiveProject}
              onAdd={() => setProjectDialogOpen(true)}
            />
          </div>
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
          {/* ── The memory in play, and its boundary ── */}
          {activeProject && (
            <MemoryStatus
              variant="strip"
              clientName={client.name}
              memoryCount={detail?.memoryCount ?? null}
              relevant={detail ? relevant : undefined}
              memoryAvailability={memoryAvailability}
              bankId={client.hindsightBankId}
              footer={
                <div className="flex flex-col gap-1.5 md:flex-row md:items-start md:justify-between md:gap-6">
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
                  {detail && openConflicts === 0 && (
                    <p className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
                      <Icon name="check" className="h-3.5 w-3.5 text-memory" strokeWidth={2.25} />
                      No unresolved preference conflicts for this project.
                    </p>
                  )}
                </div>
              }
            />
          )}

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

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-8">
            {/* ── Decision memory: the star of the page ── */}
            <section aria-labelledby="memory-heading" className="min-w-0">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 id="memory-heading" className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-memory">
                    <Icon name="layers" className="h-3.5 w-3.5" strokeWidth={2} />
                    Decision memory
                  </h2>
                  <p className="mt-1 text-[0.9375rem] text-ink-soft">
                    What ClientOS currently remembers about {client.name}
                  </p>
                </div>
                <Link to={memoryHref} className="link inline-flex shrink-0 items-center gap-1 text-xs">
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
                <div key={activeProjectId} className="surface animate-fade-in overflow-hidden">
                  <MemorySummary memory={memory} />

                  {relevant.total === 0 ? (
                    <div className="flex flex-col items-center px-6 py-10 text-center">
                      <span aria-hidden="true" className="mb-3 grid h-10 w-10 place-items-center rounded-full border border-line bg-paper-sunken text-ink-muted">
                        <Icon name="layers" className="h-[1.125rem] w-[1.125rem]" />
                      </span>
                      <p className="section-title">No decisions recorded yet.</p>
                      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">
                        Add the client's feedback and ClientOS will extract durable decisions worth
                        remembering.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-line">
                      {GROUPS.filter((g) => memory[g.key].length > 0).map((g) => (
                        <MemoryPanel
                          key={g.key}
                          id={`memory-${g.key}`}
                          title={g.title}
                          icon={g.icon}
                          tone={g.tone}
                          description={g.description}
                          memories={memory[g.key]}
                          emptyLabel=""
                          headingHidden={g.key === 'changes'}
                        />
                      ))}
                    </div>
                  )}

                  <p className="border-t border-line-soft bg-paper-sunken/50 px-4 py-2.5 text-xs leading-relaxed text-ink-muted sm:px-5">
                    {activeProject?.name}'s own decisions, plus the ones marked{' '}
                    <span className="font-medium text-ink-soft">All projects</span> that belong to{' '}
                    {client.name}. Which of them a given recommendation uses depends on the question asked.
                  </p>
                </div>
              )}
            </section>

            {/* ── Record feedback, and the history it came from ── */}
            {/* Desktop only: stays in view beneath the header while the memory
                column scrolls, capped to the viewport with its own scroll so no
                part of it becomes unreachable. The inner padding keeps focus rings
                from being clipped by that scroll box. */}
            <aside
              aria-label="Feedback and history"
              className="min-w-0 space-y-5 lg:sticky lg:top-[4.75rem] lg:-m-1 lg:max-h-[calc(100dvh_-_5.75rem)] lg:overflow-y-auto lg:overscroll-contain lg:p-1 lg:[scrollbar-width:thin]"
            >
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

              <section aria-labelledby="history-heading">
                <div className="mb-1.5 flex items-baseline justify-between gap-3 px-0.5">
                  <h2 id="history-heading" className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink">
                    Project history
                  </h2>
                  {history && history.interactions.length > 0 && (
                    <span className="text-2xs tabular-nums text-ink-muted">
                      {history.interactions.length} interaction{history.interactions.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>

                {interactionsState.error !== null ? (
                  <ErrorState error={interactionsState.error} onRetry={interactionsState.reload} />
                ) : !history ? (
                  <LoadingState label="Loading history" rows={2} />
                ) : history.interactions.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-center text-xs leading-relaxed text-ink-muted">
                    No feedback recorded yet.
                    <br />
                    Add what the client told you and it will appear here.
                  </p>
                ) : (
                  <InteractionTimeline interactions={history.interactions} />
                )}
              </section>
            </aside>
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

/**
 * What ClientOS currently holds, counted from the memories themselves. Each figure
 * jumps to its group; an empty category is shown as zero, not hidden, so the
 * summary never implies a decision exists that does not.
 */
function MemorySummary({ memory }: { memory: ProjectDetail['memory'] }) {
  const cells = SUMMARY_ORDER
    .map((key) => GROUPS.find((g) => g.key === key)!)
    .filter((g) => g.core || memory[g.key].length > 0);

  return (
    // Four across where each label fits on one line; two across otherwise. Flex
    // rather than grid so an odd extra category fills its row instead of leaving
    // empty cells.
    <div className="flex flex-wrap gap-px border-b border-line bg-line">
      {cells.map((g) => {
        const n = memory[g.key].length;
        return (
          <button
            key={g.key}
            type="button"
            disabled={n === 0}
            onClick={() => scrollToGroup(`memory-${g.key}`)}
            className="group flex min-w-0 grow basis-[calc(50%_-_1px)] flex-col items-start bg-paper px-4 py-3 text-left transition-colors hover:bg-paper-raised focus-visible:ring-inset disabled:cursor-default sm:px-5 md:basis-[calc(25%_-_1px)] lg:basis-[calc(50%_-_1px)] min-[1400px]:basis-[calc(25%_-_1px)]"
          >
            <span className="flex w-full items-start justify-between gap-2">
              <span className={`font-display text-[1.625rem] font-medium leading-none tabular-nums ${n === 0 ? 'text-ink-faint' : 'text-ink'}`}>
                {n}
              </span>
              <Icon name={g.icon} className={`mt-0.5 h-3.5 w-3.5 ${n === 0 ? 'text-ink-faint' : TONE_TEXT[g.tone]}`} strokeWidth={2.25} />
            </span>
            <span className="mt-1.5 max-w-full truncate text-xs leading-snug text-ink-muted group-hover:text-ink-soft">
              {n === 1 ? g.summary[0] : g.summary[1]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The decision-memory groups, in the order the page shows them. */
type GroupKey = keyof ProjectDetail['memory'];

const GROUPS: Array<{
  key: GroupKey;
  title: string;
  summary: [singular: string, plural: string];
  icon: IconName;
  tone: PanelTone;
  description?: string;
  /** Always counted in the summary, even at zero. */
  core?: boolean;
}> = [
  // First, because a change of mind is where ClientOS visibly learns.
  { key: 'changes', title: 'Preference changes', summary: ['Preference change', 'Preference changes'], icon: 'swap', tone: 'accent', core: true },
  { key: 'preferences', title: 'Current preferences', summary: ['Current preference', 'Current preferences'], icon: 'bookmark', tone: 'neutral', core: true },
  { key: 'approvals', title: 'Approved', summary: ['Approved direction', 'Approved directions'], icon: 'check', tone: 'memory', core: true },
  {
    key: 'rejections', title: 'Rejected approaches', summary: ['Rejected approach', 'Rejected approaches'], icon: 'x', tone: 'reject', core: true,
    description: 'ClientOS steers away from these in every recommendation.',
  },
  { key: 'constraints', title: 'Constraints', summary: ['Constraint', 'Constraints'], icon: 'lock', tone: 'caution' },
  { key: 'decisions', title: 'Decisions', summary: ['Decision', 'Decisions'], icon: 'flag', tone: 'neutral' },
  { key: 'outcomes', title: 'Outcomes', summary: ['Outcome', 'Outcomes'], icon: 'target', tone: 'neutral' },
];

/** The summary reads in the order people think about a client, not display order. */
const SUMMARY_ORDER: GroupKey[] = ['preferences', 'approvals', 'rejections', 'changes', 'constraints', 'decisions', 'outcomes'];

const TONE_TEXT: Record<PanelTone, string> = {
  neutral: 'text-ink-muted',
  memory: 'text-memory',
  reject: 'text-reject',
  accent: 'text-accent',
  caution: 'text-caution',
};

function scrollToGroup(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  el.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
