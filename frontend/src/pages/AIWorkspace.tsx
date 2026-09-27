import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync, useMutation } from '../hooks/useAsync';
import { agent, clients, conflicts as conflictsApi, projects } from '../services/clientos';
import { RecommendationCard } from '../components/RecommendationCard';
import { MemoryUsedBanner } from '../components/MemoryUsedBanner';
import { ConflictCard } from '../components/ConflictCard';
import { FeedbackComposer } from '../components/FeedbackComposer';
import { EmptyState, ErrorState, LoadingState, Spinner } from '../components/States';
import type { ConflictScope, Recommendation } from '../types/api';

const DEFAULT_REQUEST = 'Create the next homepage direction.';

/**
 * The primary screen.
 *
 * Hierarchy follows the brief: RECOMMENDATION, then WHY, then MEMORY EVIDENCE.
 * The "Use client memory" toggle makes the generic-vs-personalised contrast a
 * single visible switch, with memoryUsed/memoryCount read from the response
 * rather than asserted.
 */
export function AIWorkspace() {
  const { clientId = '' } = useParams();
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  const [useMemory, setUseMemory] = useState(true);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [feedbackDone, setFeedbackDone] = useState(false);

  const clientState = useAsync((s) => clients.get(clientId, s), [clientId]);
  const project = clientState.data?.projects[0];
  const projectId = project?.id ?? '';

  const conflictState = useAsync(
    (s) => projects.conflicts(projectId, 'pending', s),
    [projectId],
    { enabled: Boolean(projectId) },
  );

  const ask = useMutation(async () => {
    setFeedbackDone(false);
    const response = await agent.recommend({
      clientId: clientState.data!.client.id,
      projectId,
      message: request.trim(),
      useMemory,
    });
    setResult(response);
    return response;
  });

  const resolve = useMutation(
    async (conflictId: string, resolution: 'new_preference' | 'keep_existing', scope?: ConflictScope) => {
      const res = await conflictsApi.resolve(conflictId, scope ? { resolution, scope } : { resolution });
      conflictState.reload();
      // The confirmed change alters future recall, so the shown recommendation is stale.
      setResult(null);
      return res;
    },
  );

  const feedback = useMutation(async (verdict: 'accepted' | 'rejected' | 'corrected', comment?: string) => {
    const res = await agent.feedback(result!.recommendationId, comment ? { verdict, comment } : { verdict });
    setFeedbackDone(true);
    return res;
  });

  if (clientState.loading) return <LoadingState label="Loading client" />;
  if (clientState.error) return <ErrorState error={clientState.error} onRetry={clientState.reload} />;
  if (!clientState.data) return null;

  const { client } = clientState.data;
  const pendingConflicts = conflictState.data?.conflicts ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">AI workspace</p>
        <h1 className="mt-1 font-display text-2xl tracking-tight text-ink">
          {client.name}
          {project && <span className="text-ink-muted"> · {project.name}</span>}
        </h1>
      </header>

      {/* Preference changes are resolved before anything else: memory must be
          settled before a recommendation can be trusted. */}
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

      <section className="card p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (request.trim() && projectId) void ask.run();
          }}
        >
          <label htmlFor="request" className="label">Ask ClientOS</label>
          <textarea
            id="request"
            className="input min-h-[4.5rem] resize-y font-display text-base"
            value={request}
            onChange={(e) => setRequest(e.target.value.slice(0, 1000))}
            maxLength={1000}
            placeholder={DEFAULT_REQUEST}
            required
            disabled={ask.pending}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={useMemory}
                onChange={(e) => setUseMemory(e.target.checked)}
                disabled={ask.pending}
                className="h-4 w-4 accent-[#1f3a5f]"
              />
              Use client memory
              <span className="text-xs text-ink-muted">
                {useMemory ? '(recalls this client’s history)' : '(generic answer, no history)'}
              </span>
            </label>

            <button
              type="submit"
              className="btn-primary"
              disabled={ask.pending || !request.trim() || !projectId}
            >
              {ask.pending && <Spinner />}
              {ask.pending ? (useMemory ? 'Recalling memory…' : 'Reasoning…') : 'Generate direction'}
            </button>
          </div>
        </form>
      </section>

      {ask.pending && <LoadingState label="Generating recommendation" rows={3} />}

      {ask.error !== null && (
        <ErrorState
          error={ask.error}
          onRetry={() => void ask.run()}
          context="No recommendation was generated."
        />
      )}

      {result && !ask.pending && (
        <div className="space-y-5">
          <MemoryUsedBanner recommendation={result} />

          <section className="card p-5">
            <p className="eyebrow">Recommendation</p>
            <p className="mt-2 font-display text-lg leading-relaxed text-ink">{result.summary}</p>
          </section>

          {result.items.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2.5">Key recommendations</h2>
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
            {result.model} · {result.latencyMs} ms · recommendation {result.recommendationId.slice(0, 8)}
          </p>
        </div>
      )}

      {!result && !ask.pending && !ask.error && (
        <EmptyState
          title="Ask for a direction"
          description={`Try “${DEFAULT_REQUEST}” — then turn “Use client memory” off and on to see how much this client’s history changes the answer.`}
        />
      )}
    </div>
  );
}
