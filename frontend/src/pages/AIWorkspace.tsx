import { useEffect, useRef, useState } from 'react';
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
import { EmptyState, ErrorState } from '../components/States';
import { forgetDirection, recallDirection, rememberDirection } from '../lib/lastDirection';
import { flattenProjectMemory, splitRelevant } from '../lib/memoryCounts';
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
  const [elapsed, setElapsed] = useState(0);
  const { availability: memoryAvailability } = useMemoryHealth();

  const clientState = useAsync((s) => clients.get(clientId, s), [clientId]);
  const { activeProject, activeProjectId, setActiveProject } = useActiveProject(
    clientState.data?.projects,
  );

  const projectState = useAsync(
    (s) => projects.get(activeProjectId, s),
    [activeProjectId],
    { enabled: Boolean(activeProjectId) },
  );
  const conflictState = useAsync(
    (s) => projects.conflicts(activeProjectId, 'pending', s),
    [activeProjectId],
    { enabled: Boolean(activeProjectId) },
  );
  // Used only to give the previous decision its source and scope in the conflict
  // panel — the conflict payload carries the statement but not its provenance.
  const memoryState = useAsync(
    (s) => projects.memory(activeProjectId, '', s),
    [activeProjectId],
    { enabled: Boolean(activeProjectId) },
  );

  const ask = useMutation(async () => {
    setFeedbackDone(false);
    const response = await agent.recommend({
      clientId: clientState.data!.client.id,
      projectId: activeProjectId,
      message: request.trim(),
      useMemory,
    });
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
    resetAsk();
  }, [activeProjectId, resetAsk]);

  // Drives the workflow-status list while the single backend call is in flight.
  const startedAt = useRef(0);
  useEffect(() => {
    if (!ask.pending) return;
    startedAt.current = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 200);
    return () => window.clearInterval(timer);
  }, [ask.pending]);

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
  if (!clientState.data) return null;

  const { client } = clientState.data;
  const projectList = clientState.data.projects;
  const pendingConflicts = conflictState.data?.conflicts ?? [];
  const memoryCount = projectState.data?.memoryCount ?? 0;
  // What that number is made of — this project's own decisions plus the
  // client-wide ones. Derived from the returned memories, not assumed.
  const relevant = splitRelevant(flattenProjectMemory(projectState.data?.memory));
  const interactionCount = activeProject?.interactionCount ?? 0;
  const memoryHref = `/clients/${clientId}/memory${activeProject ? `?project=${activeProject.slug}` : ''}`;
  const canGenerate = Boolean(request.trim()) && Boolean(activeProjectId) && !ask.pending;

  if (!activeProject) {
    return (
      <EmptyState
        title="No project yet"
        description="ClientOS needs a project before it can reason about this client's work."
        action={<Link to={`/clients/${clientId}`} className="btn-primary">Go to workspace</Link>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
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
        relevant={relevant}
        interactionCount={interactionCount}
        memoryAvailability={memoryAvailability}
        memoryEnabled={useMemory}
        bankId={client.hindsightBankId}
      />

      <p className="-mt-6 text-xs leading-relaxed text-ink-muted">
        Recalled from Hindsight: this project's decisions + applicable client-wide preferences.
        Other projects for {client.name} are not recalled.
      </p>

      {/* Memory must be settled before a recommendation can be trusted. */}
      {pendingConflicts.length > 0 && (
        <div className="space-y-3">
          {pendingConflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              projectName={activeProject.name}
              oldMemory={findOldMemory(conflict, memoryState.data?.memories)}
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
        <h2 id="ask-heading" className="eyebrow">Ask ClientOS</h2>

        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canGenerate) void ask.run();
          }}
        >
          <label htmlFor="request" className="sr-only">What should we do next?</label>
          <textarea
            id="request"
            className="w-full resize-y rounded-xl border border-black/[0.09] bg-paper px-4 py-3.5 font-display text-lg leading-relaxed text-ink placeholder:text-ink-muted/60 focus:border-accent-ring"
            rows={2}
            value={request}
            onChange={(e) => setRequest(e.target.value.slice(0, 1000))}
            maxLength={1000}
            placeholder="What should we do next?"
            required
            disabled={ask.pending}
          />

          {!result && !ask.pending && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.filter((s) => s !== request).slice(0, 2).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRequest(s)}
                  className="rounded-full bg-paper-sunken px-3 py-1 text-xs text-ink-muted transition-colors hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            <MemoryToggle
              enabled={useMemory}
              onChange={setUseMemory}
              clientName={client.name}
              memoryCount={memoryCount}
              disabled={ask.pending}
              memoryAvailability={memoryAvailability}
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button type="submit" className="btn-primary w-full sm:w-auto" disabled={!canGenerate}>
              {ask.pending ? 'Generating…' : 'Generate direction →'}
            </button>
          </div>
        </form>
      </section>

      {ask.pending && <GenerationProgress useMemory={useMemory} elapsedMs={elapsed} />}

      {ask.error !== null && !ask.pending && (
        <ErrorState
          error={ask.error}
          onRetry={() => void ask.run()}
          context="No recommendation was generated."
        />
      )}

      {/* ── Result ──────────────────────────────────────────── */}
      {result && !ask.pending && (
        <div className="space-y-8">
          {/* 1 — RECOMMENDATION: the dominant element on the page. */}
          <section aria-labelledby="recommendation-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="recommendation-heading" className="eyebrow">Recommendation</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium ${
                  result.memoryUsed
                    ? 'bg-approve-soft text-approve'
                    : 'bg-caution-soft text-caution'
                }`}
              >
                {result.memoryUsed
                  ? `Grounded in ${result.memoryCount} recalled memor${result.memoryCount === 1 ? 'y' : 'ies'}`
                  : 'Memory off'}
              </span>
            </div>

            <div
              className={`mt-3 rounded-2xl border bg-paper px-6 py-6 shadow-card sm:px-8 sm:py-7 ${
                result.memoryUsed ? 'border-black/[0.07]' : 'border-caution/25'
              }`}
            >
              <p className="font-display text-[1.375rem] leading-[1.55] text-ink sm:text-2xl sm:leading-[1.5]">
                {result.summary}
              </p>
            </div>

            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
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
          </section>

          {/* 2 — WHY THIS DIRECTION */}
          {(result.items.length > 0 || result.avoid.length > 0) && (
            <section aria-labelledby="why-heading">
              <h2 id="why-heading" className="eyebrow">Why this direction</h2>

              <div className="mt-3 rounded-2xl border border-black/[0.07] bg-paper px-5 py-4 shadow-card">
                {result.items.length > 0 && (
                  <ul className="space-y-3.5">
                    {result.items.map((line) => (
                      <RecommendationCard key={line.id} line={line} variant="recommend" />
                    ))}
                  </ul>
                )}

                {result.avoid.length > 0 && (
                  <div className={result.items.length > 0 ? 'mt-5 border-t border-black/[0.06] pt-4' : ''}>
                    <p className="eyebrow mb-3">Avoid</p>
                    <ul className="space-y-3.5">
                      {result.avoid.map((line) => (
                        <RecommendationCard key={line.id} line={line} variant="avoid" />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 3 — CLIENT EVIDENCE */}
          <ClientEvidence recommendation={result} />

          {result.notes.length > 0 && (
            <section aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="eyebrow">Not covered by memory</h2>
              <ul className="mt-2.5 space-y-1.5">
                {result.notes.map((note, i) => (
                  <li key={i} className="text-sm leading-relaxed text-ink-soft">{note}</li>
                ))}
              </ul>
            </section>
          )}

          {result.caveats.length > 0 && (
            <section
              aria-labelledby="caveats-heading"
              className="rounded-xl border border-caution/25 bg-caution-soft/30 px-4 py-3.5"
            >
              <h2 id="caveats-heading" className="eyebrow text-caution">Unconfirmed changes</h2>
              <ul className="mt-2 space-y-1.5">
                {result.caveats.map((c, i) => (
                  <li key={i} className="text-sm leading-relaxed text-ink-soft">{c}</li>
                ))}
              </ul>
            </section>
          )}

          <FeedbackComposer
            onSubmit={(verdict, comment) => void feedback.run(verdict, comment)}
            pending={feedback.pending}
            done={feedbackDone}
            error={feedback.errorMessage}
          />

          <p className="text-[0.6875rem] text-ink-muted">
            {result.model} · {result.latencyMs} ms
          </p>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {!result && !ask.pending && ask.error === null && !lastResolution && !supersededSummary && (
        <section className="rounded-2xl bg-paper-sunken px-6 py-7 sm:px-8">
          <p className="font-display text-base text-ink">
            Describe what you want help deciding.
          </p>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-muted">
            {memoryCount === 0 ? (
              <>
                {activeProject.name} has no recorded decisions yet, so the first direction will
                be generic.{' '}
                <Link to={`/clients/${clientId}`} className="font-medium text-accent underline">
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
        </section>
      )}
    </div>
  );
}
