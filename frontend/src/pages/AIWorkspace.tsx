import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync, useMutation } from '../hooks/useAsync';
import { useActiveProject } from '../hooks/useActiveProject';
import { useMemoryHealth } from '../hooks/useMemoryHealth';
import { agent, clients, conflicts as conflictsApi, projects } from '../services/clientos';
import { RecommendationCard } from '../components/RecommendationCard';
import { ConflictCard } from '../components/ConflictCard';
import { FeedbackComposer } from '../components/FeedbackComposer';
import { MemoryToggle } from '../components/MemoryToggle';
import { GenerationProgress } from '../components/GenerationProgress';
import { RecommendationChange } from '../components/RecommendationChange';
import { ClientContextBar } from '../components/ClientContextBar';
import { EmptyState, ErrorState } from '../components/States';
import type { ConflictScope, Recommendation, ResolveConflictResult } from '../types/api';

const DEFAULT_REQUEST = 'Create the next homepage direction.';

const SUGGESTIONS = [
  'Create the next homepage direction.',
  'Draft the tone of voice for the landing page.',
  'What should we avoid in the next revision?',
];

export function AIWorkspace() {
  const { clientId = '' } = useParams();
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  const [useMemory, setUseMemory] = useState(true);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [lastResolution, setLastResolution] = useState<ResolveConflictResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const { status: health } = useMemoryHealth();

  const clientState = useAsync((s) => clients.get(clientId, s), [clientId]);
  const { activeProject, activeProjectId } = useActiveProject(clientState.data?.projects);

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

  const ask = useMutation(async () => {
    setFeedbackDone(false);
    setLastResolution(null);
    const response = await agent.recommend({
      clientId: clientState.data!.client.id,
      projectId: activeProjectId,
      message: request.trim(),
      useMemory,
    });
    setResult(response);
    return response;
  });

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
      // Memory changed, so the recommendation on screen is now stale.
      setResult(null);
      setLastResolution(res.newMemory ? res : null);
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
  const pendingConflicts = conflictState.data?.conflicts ?? [];
  const memoryCount = projectState.data?.memoryCount ?? 0;
  const interactionCount = activeProject?.interactionCount ?? 0;
  const memoryConnected = health?.connected ?? false;
  const memoryHref = `/clients/${clientId}/memory${activeProject ? `?project=${activeProject.slug}` : ''}`;

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
    <div className="space-y-5">
      <header>
        <p className="eyebrow">AI workspace</p>
        <h1 className="mt-1 font-display text-2xl tracking-tight text-ink">
          {client.name}
          <span className="text-ink-muted"> · {activeProject.name}</span>
        </h1>
      </header>

      <ClientContextBar
        clientName={client.name}
        projectName={activeProject.name}
        memoryCount={memoryCount}
        interactionCount={interactionCount}
        memoryConnected={memoryConnected}
      />

      {/* Memory must be settled before a recommendation can be trusted. */}
      {pendingConflicts.length > 0 && (
        <div className="space-y-3">
          {pendingConflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              pending={resolve.pending}
              error={resolve.errorMessage}
              onResolve={(resolution, scope) => void resolve.run(conflict.id, resolution, scope)}
            />
          ))}
        </div>
      )}

      {lastResolution && (
        <RecommendationChange
          resolution={lastResolution}
          memoryHref={memoryHref}
          regenerating={ask.pending}
          onRegenerate={() => void ask.run()}
        />
      )}

      <section className="card p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (request.trim() && activeProjectId) void ask.run();
          }}
        >
          <label htmlFor="request" className="label">Ask ClientOS</label>
          <textarea
            id="request"
            className="input min-h-[4.5rem] resize-y font-display text-base"
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
                  className="rounded-full border border-black/[0.07] bg-paper-sunken px-2.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3.5">
            <MemoryToggle
              enabled={useMemory}
              onChange={setUseMemory}
              clientName={client.name}
              memoryCount={memoryCount}
              disabled={ask.pending}
              memoryConnected={memoryConnected}
            />
          </div>

          <button
            type="submit"
            className="btn-primary mt-3.5 w-full sm:w-auto"
            disabled={ask.pending || !request.trim() || !activeProjectId}
          >
            {ask.pending ? 'Generating…' : 'Generate recommendation'}
          </button>
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

      {result && !ask.pending && (
        <div className="space-y-5">
          {/* 1 — RECOMMENDATION, visually dominant. */}
          <section
            className={`card border-l-2 p-5 ${result.memoryUsed ? 'border-l-approve' : 'border-l-caution'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">Recommendation</p>
              {result.memoryUsed ? (
                <span className="rounded-full bg-approve-soft px-2.5 py-0.5 text-xs font-medium text-approve">
                  Grounded in {result.memoryCount} memor{result.memoryCount === 1 ? 'y' : 'ies'}
                </span>
              ) : (
                <span className="rounded-full bg-caution-soft px-2.5 py-0.5 text-xs font-medium text-caution">
                  Memory disabled
                </span>
              )}
            </div>

            <p className="mt-2.5 font-display text-xl leading-relaxed text-ink">{result.summary}</p>

            {!result.memoryUsed && (
              <p className="mt-3 rounded-lg bg-caution-soft/50 px-3 py-2.5 text-sm leading-relaxed text-ink-soft">
                This recommendation does not use previous client decisions.{' '}
                <span className="font-medium">0 client-memory citations.</span>
              </p>
            )}
          </section>

          {/* 2 — WHY THIS DIRECTION, 3 — CLIENT EVIDENCE (inside each card). */}
          {result.items.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2.5">Why this direction</h2>
              <ul className="space-y-2">
                {result.items.map((line) => (
                  <RecommendationCard key={line.id} line={line} variant="recommend" />
                ))}
              </ul>
            </section>
          )}

          {result.avoid.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2.5">Avoid</h2>
              <ul className="space-y-2">
                {result.avoid.map((line) => (
                  <RecommendationCard key={line.id} line={line} variant="avoid" />
                ))}
              </ul>
            </section>
          )}

          {result.notes.length > 0 && (
            <section className="card p-4">
              <h2 className="eyebrow mb-2">Not covered by memory</h2>
              <ul className="space-y-1.5">
                {result.notes.map((note, i) => (
                  <li key={i} className="text-sm leading-relaxed text-ink-soft">{note}</li>
                ))}
              </ul>
            </section>
          )}

          {result.caveats.length > 0 && (
            <section className="card border-l-2 border-l-caution bg-caution-soft/30 p-4">
              <h2 className="eyebrow mb-2 text-caution">Unconfirmed changes</h2>
              <ul className="space-y-1.5">
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

      {!result && !ask.pending && ask.error === null && !lastResolution && (
        <section className="card p-5">
          <p className="eyebrow">What ClientOS will draw on</p>
          {memoryCount === 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              This project has no recorded decisions yet, so the first recommendation will be
              generic.{' '}
              <Link to={`/clients/${clientId}`} className="font-medium text-accent underline">
                Add client feedback
              </Link>{' '}
              and ask again to see the difference.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {memoryCount} recorded decision{memoryCount === 1 ? '' : 's'} across{' '}
              {interactionCount} interaction{interactionCount === 1 ? '' : 's'}. Turn client memory
              off and on to compare a generic answer with a grounded one.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
