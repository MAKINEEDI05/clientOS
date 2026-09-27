/**
 * Workflow status while the existing pipeline runs.
 *
 * These are the real stages the backend goes through, advanced on elapsed time
 * because the request is a single round trip. It reports *where* the work is —
 * never the model's reasoning.
 */
const STEPS_WITH_MEMORY = [
  'Analysing request',
  'Recalling client history',
  'Checking previous decisions',
  'Generating direction',
] as const;

const STEPS_WITHOUT_MEMORY = ['Analysing request', 'Generating direction'] as const;

export function GenerationProgress({
  useMemory, elapsedMs,
}: { useMemory: boolean; elapsedMs: number }) {
  const steps = useMemory ? STEPS_WITH_MEMORY : STEPS_WITHOUT_MEMORY;
  const perStep = useMemory ? 1100 : 900;
  const active = Math.min(Math.floor(elapsedMs / perStep), steps.length - 1);

  return (
    <div className="rounded-xl border border-black/[0.07] bg-paper px-5 py-4" role="status" aria-live="polite">
      <ol className="space-y-2.5">
        {steps.map((step, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={step} className="flex items-center gap-3 text-sm">
              <span className="w-3.5 shrink-0 text-center" aria-hidden="true">
                {done ? (
                  <span className="text-approve">✓</span>
                ) : current ? (
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                ) : (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-muted/25" />
                )}
              </span>
              <span
                className={
                  done ? 'text-ink-muted' : current ? 'font-medium text-ink' : 'text-ink-muted/60'
                }
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
