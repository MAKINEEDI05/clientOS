import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync, useMutation } from '../hooks/useAsync';
import { useActiveProject } from '../hooks/useActiveProject';
import { useMemoryHealth } from '../hooks/useMemoryHealth';
import { agent, clients, conflicts as conflictsApi, projects } from '../services/clientos';
import { RecommendationCard } from '../components/RecommendationCard';
import { ClientEvidence } from '../components/ClientEvidence';
import { ConflictCard, findOldMemory } from '../components/ConflictCard';
import { ConflictResolved } from '../components/ConflictResolved';
import { FeedbackComposer } from '../components/FeedbackComposer';
import { MemoryToggle } from '../components/MemoryToggle';
import { GenerationProgress } from '../components/GenerationProgress';
import { RecommendationChange } from '../components/RecommendationChange';
import { ClientContextBar } from '../components/ClientContextBar';
import { ProjectContextSelector } from '../components/ProjectContextSelector';
import { EmptyState, ErrorState, LoadingState, Spinner } from '../components/States';
import { Icon } from '../components/Icon';
import { forgetDirection, recallDirection, rememberDirection } from '../lib/lastDirection';
import { MemoryComparison } from '../components/MemoryComparison';
import { recallMemoryOff, rememberMemoryOff } from '../lib/memoryComparison';
import { flattenProjectMemory, splitRelevant } from '../lib/memoryCounts';
import { isClient } from '../lib/identity';
import type { ConflictScope, Recommendation, ResolveConflictResult } from '../types/api';

const DEFAULT_REQUEST = 'Create the next homepage direction.';

const SUGGESTIONS = [
  'Create the next homepage direction.',
  'Draft the tone of voice for the landing page.',
  'What should we avoid in the next revision?',
];

/**
 * The flagship screen.
 *
 * The page reads top to bottom as the product's own story:
 *   client + memory  →  request  →  RECOMMENDATION  →  why  →  client evidence
 * The recommendation carries the most visual weight; everything else supports it.
 */
export function AIWorkspace() {
  const { clientId = '' } = useParams();
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  const [useMemory, setUseMemory] = useState(true);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [lastResolution, setLastResolution] = useState<ResolveConflictResult | null>(null);
  // The direction that was on screen when a preference change was applied.
  // Kept so the before/after comparison uses real output, not a re-description.
  const [supersededSummary, setSupersededSummary] = useState<string | null>(null);
  const { availability: memoryAvailability } = useMemoryHealth();

  const clientState = useAsync((s) => clients.get(clientId, s), [clientId]);
  // Never show one client's data under another client's URL while switching.
  const clientData = isClient(clientState.data, clientId) ? clientState.data : null;
  const { activeProject, activeProjectId, setActiveProject } = useActiveProject(clientData?.projects);

  // Project-scoped loads remember which project they were for, so a previous
  // project's memory or conflicts are never shown under the newly selected one.
  const projectState = useAsync(
    (s) => projects.get(activeProjectId, s),
    [activeProjectId],
    { enabled: Boolean(activeProjectId) },
  );
  const conflictState = useAsync(
    (s) => projects.conflicts(activeProjectId, 'pending', s)
      .then((r) => ({ ...r, projectId: activeProjectId })),
    [activeProjectId],
    { enabled: Boolean(activeProjectId) },
  );
  // Used only to give the previous decision its source and scope in the conflict
  // panel — the conflict payload carries the statement but not its provenance.
  const memoryState = useAsync(
    (s) => projects.memory(activeProjectId, '', s)
      .then((r) => ({ ...r, projectId: activeProjectId })),
    [activeProjectId],
    { enabled: Boolean(activeProjectId) },
  );

  // The real memory-off answer to THIS request, looked up when a memory-backed
  // answer arrives. Held in state so the rendered comparison cannot drift as the
  // request box is edited afterwards.
  const [comparisonBaseline, setComparisonBaseline] = useState<string | null>(null);

  const ask = useMutation(async () => {
    setFeedbackDone(false);
    const clientDbId = clientData!.client.id;
    const asked = request.trim();

    // A throw here propagates out of useMutation.run, so nothing below runs on a
    // failed generation: a failed answer is never stored and never compared.
    const response = await agent.recommend({
      clientId: clientDbId,
      projectId: activeProjectId,
      message: asked,
      useMemory,
    });

    if (useMemory) {
      // Only pair it with a baseline if memory genuinely informed this answer.
      // Memory on but nothing recalled is not a "with memory" difference.
      setComparisonBaseline(
        response.memoryUsed
          ? recallMemoryOff(clientDbId, activeProjectId, asked)?.summary ?? null
          : null,
      );
    } else {
      // This IS the baseline for the next memory-backed run of the same request.
      rememberMemoryOff(clientDbId, activeProjectId, asked, response.summary, response.recommendationId);
      setComparisonBaseline(null);
    }

    setResult(response);
    rememberDirection(activeProjectId, response.summary);
    return response;
  });

  // Switching project switches memory context, so anything on screen from the
  // previous project is no longer about the project now named above it.
  const resetAsk = ask.reset;
  useEffect(() => {
    setResult(null);
    setFeedbackDone(false);
    setLastResolution(null);
    setSupersededSummary(null);
    setComparisonBaseline(null);
    resetAsk();
  }, [activeProjectId, resetAsk]);

  const resolve = useMutation(
    async (conflictId: string, resolution: 'new_preference' | 'keep_existing', scope?: ConflictScope) => {
      const res = await conflictsApi.resolve(conflictId, scope ? { resolution, scope } : { resolution });
      conflictState.reload();
      projectState.reload();
      memoryState.reload();
      // Memory changed, so the direction on screen is now stale. Hold on to its
      // summary first — it is the honest "before" for the comparison.
      setSupersededSummary(
        res.newMemory ? (result?.summary ?? recallDirection(activeProjectId)) : null,
      );
      setResult(null);
      setComparisonBaseline(null);
      setLastResolution(res);
      return res;
    },
  );

  const feedback = useMutation(async (verdict: 'accepted' | 'rejected' | 'corrected', comment?: string) => {
    const res = await agent.feedback(result!.recommendationId, comment ? { verdict, comment } : { verdict });
    setFeedbackDone(true);
    return res;
  });

  if (clientState.error !== null) {
    return <ErrorState error={clientState.error} onRetry={clientState.reload} />;
  }
  if (!clientData) {
    return (
      <div className="mx-auto max-w-3xl">
        <LoadingState label="Loading client" rows={2} />
      </div>
    );
  }

  const { client } = clientData;
  const projectList = clientData.projects;
  const detail = projectState.data?.project.id === activeProjectId ? projectState.data : null;
  const pendingConflicts = conflictState.data?.projectId === activeProjectId
    ? conflictState.data.conflicts
    : [];
  const projectMemories = memoryState.data?.projectId === activeProjectId
    ? memoryState.data.memories
    : undefined;
  // How much memory this project can draw on — unknown (null) until the active
  // project's own detail has loaded, rather than a stale or placeholder figure.
  const memoryCount = detail ? detail.memoryCount : null;
  // What that number is made of — this project's own decisions plus the
  // client-wide ones. Derived from the returned memories, not assumed.
  const relevant = splitRelevant(flattenProjectMemory(detail?.memory));
  const interactionCount = activeProject?.interactionCount ?? 0;
  const memoryHref = `/clients/${clientId}/memory${activeProject ? `?project=${activeProject.slug}` : ''}`;
  const canGenerate = Boolean(request.trim()) && Boolean(activeProjectId) && !ask.pending;

  if (!activeProject) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon="folder"
          title="No project yet"
          description="ClientOS needs a project before it can reason about this client's work."
          action={<Link to={`/clients/${clientId}`} className="btn-primary">Go to workspace</Link>}
        />
      </div>
    );
  }

  const suggestions = SUGGESTIONS.filter((s) => s !== request).slice(0, 2);

  return (
    <div className="mx-auto max-w-3xl space-y-6 sm:space-y-8">
      {/* ── Whose memory, which project, and whether it is reachable ── */}
      <div>
        <ClientContextBar
          clientName={client.name}
          projectControl={
            <ProjectContextSelector
              projects={projectList}
              activeId={activeProjectId}
              onSelect={setActiveProject}
              id="ai-project-context"
            />
          }
          memoryCount={memoryCount}
          relevant={detail ? relevant : undefined}
          interactionCount={interactionCount}
          memoryAvailability={memoryAvailability}
          memoryEnabled={useMemory}
          bankId={client.hindsightBankId}
        />
        <p className="mt-4 flex gap-2 border-t border-line pt-3.5 text-xs leading-relaxed text-ink-muted">
          <Icon name="shield" className="mt-px h-3.5 w-3.5 text-ink-faint" />
          <span>
            Recalled from Hindsight: this project's decisions + applicable client-wide preferences.
            Other projects for {client.name} are not recalled.
          </span>
        </p>
      </div>

      {/* Memory must be settled before a recommendation can be trusted. */}
      {pendingConflicts.length > 0 && (
        <div className="space-y-4">
          {pendingConflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              projectName={activeProject.name}
              oldMemory={findOldMemory(conflict, projectMemories)}
              pending={resolve.pending}
              error={resolve.errorMessage}
              onResolve={(resolution, scope) => void resolve.run(conflict.id, resolution, scope)}
            />
          ))}
        </div>
      )}

      {lastResolution && (
        <ConflictResolved
          resolution={lastResolution}
          projectName={activeProject.name}
          memoryHref={memoryHref}
          onDismiss={() => {
            setLastResolution(null);
            setSupersededSummary(null);
            forgetDirection(activeProjectId);
          }}
        />
      )}

      {supersededSummary && supersededSummary !== result?.summary && (
        <RecommendationChange
          projectName={activeProject.name}
          before={supersededSummary}
          after={result?.summary ?? null}
          regenerating={ask.pending}
          onRegenerate={() => void ask.run()}
        />
      )}

      {/* ── Ask ─────────────────────────────────────────────── */}
      <section aria-labelledby="ask-heading">
        <form
          className="surface overflow-hidden transition-[border-color,box-shadow] duration-150 has-[textarea:focus]:border-accent-ring has-[textarea:focus]:ring-[3px] has-[textarea:focus]:ring-accent/10"
          onSubmit={(e) => {
            e.preventDefault();
            if (canGenerate) void ask.run();
          }}
        >
          <div className="px-4 pt-4 sm:px-6 sm:pt-5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 id="ask-heading" className="eyebrow text-ink">Ask ClientOS</h2>
              <span className="inline-flex min-w-0 items-center gap-1.5 text-2xs text-ink-muted">
                <Icon name="folder" className="h-3 w-3" />
                <span className="truncate">{activeProject.name}</span>
              </span>
            </div>
            <label htmlFor="request" className="mt-1 block text-[0.8125rem] text-ink-muted">
              What should we do next?
            </label>
            <textarea
              id="request"
              className="mt-1.5 block w-full resize-y border-0 bg-transparent p-0 font-display text-[1.1875rem] leading-relaxed text-ink placeholder:text-ink-muted/80 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-[1.3125rem]"
              rows={2}
              value={request}
              onChange={(e) => setRequest(e.target.value.slice(0, 1000))}
              maxLength={1000}
              placeholder="Describe the decision you need to make…"
              required
              disabled={ask.pending}
            />

            {!result && !ask.pending && suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 pb-1">
                <span className="text-2xs font-medium text-ink-muted">Try</span>
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => setRequest(s)} className="chip">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-4 border-t border-line bg-paper-sunken/50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <MemoryToggle
              enabled={useMemory}
              onChange={setUseMemory}
              clientName={client.name}
              memoryCount={memoryCount}
              disabled={ask.pending}
              memoryAvailability={memoryAvailability}
            />
            <button type="submit" className="btn-primary w-full shrink-0 sm:w-auto" disabled={!canGenerate}>
              {ask.pending ? (
                <>
                  <Spinner className="h-3.5 w-3.5" />
                  Generating…
                </>
              ) : (
                <>
                  Generate direction
                  <Icon name="arrow-right" className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {ask.pending && <GenerationProgress useMemory={useMemory} clientName={client.name} />}

      {ask.error !== null && !ask.pending && (
        <ErrorState
          error={ask.error}
          onRetry={() => void ask.run()}
          context="No recommendation was generated."
        />
      )}

      {/* ── Result ──────────────────────────────────────────── */}
      {result && !ask.pending && (
        <div className="space-y-6">
          {/* 0 — Why this answer differs, using both real generations. Rendered
                 only when a genuine memory-off baseline exists for this exact
                 client, project and request. */}
          {comparisonBaseline && result.memoryUsed && (
            <MemoryComparison
              without={comparisonBaseline}
              with_={result.summary}
              memoryCount={result.memoryCount}
            />
          )}

          {/* The chain: recommendation ← reasoning ← recalled evidence, as one
              document so it reads as one answer. */}
          <article className="surface animate-fade-in overflow-hidden">
            {/* 1 — RECOMMENDATION: the dominant element on the page. */}
            <section aria-labelledby="recommendation-heading" className="px-5 py-6 sm:px-8 sm:py-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="recommendation-heading" className="eyebrow text-ink">Recommendation</h2>
                <span
                  className={`badge gap-1.5 px-2 py-1 ${
                    result.memoryUsed ? 'badge-memory' : 'border border-line-strong bg-paper-sunken text-ink-soft'
                  }`}
                >
                  {result.memoryUsed ? (
                    <Icon name="layers" className="h-3 w-3" strokeWidth={2.25} />
                  ) : (
                    <span aria-hidden="true" className="h-2 w-2 rounded-full border border-ink-muted" />
                  )}
                  {result.memoryUsed
                    ? `Grounded in ${result.memoryCount} recalled memor${result.memoryCount === 1 ? 'y' : 'ies'}`
                    : 'Memory off'}
                </span>
              </div>

              <p className="mt-4 font-display text-[1.3125rem] leading-[1.55] text-ink sm:text-[1.5rem] sm:leading-[1.5]">
                {result.summary}
              </p>

              <div
                className={`mt-5 flex gap-2.5 rounded-lg px-3.5 py-2.5 ${
                  result.memoryUsed ? 'bg-memory-soft/60' : 'bg-paper-sunken'
                }`}
              >
                <Icon
                  name={result.memoryUsed ? 'layers' : 'info'}
                  className={`mt-0.5 h-4 w-4 ${result.memoryUsed ? 'text-memory' : 'text-ink-muted'}`}
                />
                <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
                  {result.memoryUsed ? (
                    <>
                      Recalled {result.memoryCount} memor{result.memoryCount === 1 ? 'y' : 'ies'} from{' '}
                      {client.name}'s Hindsight memory bank for this request. Open “Why?” on any point
                      to see the decision it came from.
                    </>
                  ) : (
                    <>
                      Client memory was off for this request, so no previous decision from{' '}
                      {client.name} was recalled or used. This direction is generic.
                    </>
                  )}
                </p>
              </div>
            </section>

            {/* 2 — WHY THIS DIRECTION */}
            {(result.items.length > 0 || result.avoid.length > 0) && (
              <section aria-labelledby="why-heading" className="border-t border-line px-5 py-6 sm:px-8 sm:py-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="why-heading" className="eyebrow text-ink">Why this direction</h2>
                  {/* Accurate either way: the label follows what recall returned. */}
                  <span
                    className={`inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em] ${
                      result.memoryUsed ? 'text-memory' : 'text-ink-muted'
                    }`}
                  >
                    {result.memoryUsed ? 'From recalled client decisions' : 'General practice only'}
                  </span>
                </div>
                <p className="mt-1.5 max-w-prose text-[0.8125rem] leading-relaxed text-ink-muted">
                  {result.memoryUsed ? (
                    <>
                      How {client.name}'s recorded decisions shaped each point. A point memory does
                      not cover is marked <span className="font-medium">General practice</span> rather
                      than attributed to the client.
                    </>
                  ) : (
                    <>
                      General design practice only. No decision of {client.name}'s informed these
                      points, so none of them cites one.
                    </>
                  )}
                </p>

                {result.items.length > 0 && (
                  <ul className="mt-5 divide-y divide-line-soft">
                    {result.items.map((line) => (
                      <RecommendationCard key={line.id} line={line} variant="recommend" />
                    ))}
                  </ul>
                )}

                {result.avoid.length > 0 && (
                  <div className={`rounded-lg border border-reject-line/70 bg-reject-soft/30 px-4 py-4 ${result.items.length > 0 ? 'mt-6' : 'mt-5'}`}>
                    <p className="eyebrow mb-3 flex items-center gap-1.5 text-reject">
                      <Icon name="x" className="h-3 w-3" strokeWidth={2.5} />
                      Avoid
                    </p>
                    <ul className="divide-y divide-reject-line/40">
                      {result.avoid.map((line) => (
                        <RecommendationCard key={line.id} line={line} variant="avoid" />
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* 3 — CLIENT EVIDENCE: the bottom of the chain. */}
            <div className="border-t border-line px-5 py-6 sm:px-8 sm:py-7">
              <ClientEvidence recommendation={result} clientName={client.name} />
            </div>

            {result.notes.length > 0 && (
              <section aria-labelledby="notes-heading" className="border-t border-line px-5 py-5 sm:px-8">
                <h2 id="notes-heading" className="eyebrow">Not covered by memory</h2>
                <ul className="mt-2.5 space-y-1.5">
                  {result.notes.map((note, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                      <Icon name="info" className="mt-0.5 h-4 w-4 text-ink-faint" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.caveats.length > 0 && (
              <section
                aria-labelledby="caveats-heading"
                className="border-t border-caution-line bg-caution-soft/40 px-5 py-4 sm:px-8"
              >
                <h2 id="caveats-heading" className="eyebrow text-caution">Unconfirmed changes</h2>
                <ul className="mt-2 space-y-1.5">
                  {result.caveats.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                      <Icon name="alert" className="mt-0.5 h-4 w-4 text-caution" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="border-t border-line bg-paper-sunken/50 px-5 py-4 sm:px-8">
              <FeedbackComposer
                onSubmit={(verdict, comment) => void feedback.run(verdict, comment)}
                pending={feedback.pending}
                done={feedbackDone}
                error={feedback.errorMessage}
              />
              <p className="mt-3 text-2xs text-ink-muted">
                {result.model} · {result.latencyMs} ms
              </p>
            </div>
          </article>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {!result && !ask.pending && ask.error === null && !lastResolution && !supersededSummary && (
        <section className="flex gap-3.5 rounded-xl border border-dashed border-line-strong px-5 py-5 sm:px-6">
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-paper text-ink-muted shadow-card">
            <Icon name="compass" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Describe what you want help deciding.</p>
            <p className="mt-1 max-w-prose text-[0.8125rem] leading-relaxed text-ink-muted">
              {memoryCount === null ? (
                <>Loading what ClientOS holds for {activeProject.name}…</>
              ) : memoryCount === 0 ? (
                <>
                  {activeProject.name} has no recorded decisions yet, so the first direction will
                  be generic.{' '}
                  <Link to={`/clients/${clientId}?project=${activeProject.slug}`} className="link">
                    Add client feedback
                  </Link>{' '}
                  and ask again to see the difference.
                </>
              ) : (
                <>
                  ClientOS can draw on{' '}
                  <span className="font-medium text-ink-soft">
                    {memoryCount} memor{memoryCount === 1 ? 'y' : 'ies'}
                  </span>{' '}
                  for {activeProject.name} — {relevant.project} decided on this project and{' '}
                  {relevant.clientWide} that {relevant.clientWide === 1 ? 'applies' : 'apply'} to all
                  of {client.name}'s work.
                </>
              )}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
