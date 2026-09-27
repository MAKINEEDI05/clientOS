import { Spinner } from './States';

/**
 * Workflow status while the existing pipeline runs.
 *
 * These are the real stages the backend goes through, advanced on elapsed time
 * because the request is a single round trip. It reports *where* the work is,
 * never the model's reasoning.
 */
const STEPS_WITH_MEMORY = [
  'Analysing request',
  'Recalling client history',
  'Checking past decisions',
  'Generating direction',
] as const;

const STEPS_WITHOUT_MEMORY = ['Analysing request', 'Generating direction'] as const;

export function GenerationProgress({
  useMemory, elapsedMs,
}: { useMemory: boolean; elapsedMs: number }) {
  const steps = useMemory ? STEPS_WITH_MEMORY : STEPS_WITHOUT_MEMORY;
  // Rough pacing; the final step stays active until the response lands.
  const perStep = useMemory ? 1100 : 900;
  const active = Math.min(Math.floor(elapsedMs / perStep), steps.length - 1);

  return (
    <div className="card p-4" role="status" aria-live="polite">
      <p className="eyebrow mb-3">Working</p>
      <ol className="space-y-2">
        {steps.map((step, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={step} className="flex items-center gap-2.5 text-sm">
              <span className="w-4 shrink-0 text-center" aria-hidden="true">
                {done ? (
                  <span className="text-approve">✓</span>
                ) : current ? (
                  <Spinner className="inline h-3.5 w-3.5 text-accent" />
                ) : (
                  <span className="text-ink-muted/40">·</span>
                )}
              </span>
              <span className={done ? 'text-ink-muted' : current ? 'text-ink' : 'text-ink-muted/60'}>
                {step}
                {current && '…'}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
