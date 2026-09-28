import { ComparePanes } from './ComparePanes';

/**
 * The same question, answered twice: once without this client's memory, once with
 * it.
 *
 * Both sides are summaries the backend actually returned — the left from a real
 * memory-off generation held in session storage, the right from the generation on
 * screen now. Nothing here is written for a scenario, and no second model call is
 * made to produce it.
 *
 * Deliberately compact. The full recommendation, its reasoning and its evidence
 * remain the primary content below; this only exists so the difference does not
 * depend on the viewer's memory of the previous answer.
 */
export function MemoryComparison({
  without, with_, memoryCount,
}: {
  /** Summary of the real memory-off generation for this same request. */
  without: string;
  /** Summary of the memory-backed generation currently on screen. */
  with_: string;
  /** How many memories the current answer was grounded in. */
  memoryCount: number;
}) {
  return (
    <section
      aria-labelledby="memory-comparison-heading"
      className="surface animate-fade-in overflow-hidden"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3.5 sm:px-6">
        <h2 id="memory-comparison-heading" className="eyebrow text-ink">Memory changes the direction</h2>
        <p className="text-xs leading-relaxed text-ink-muted">
          The same request, answered without this client's history and with it.
        </p>
      </div>

      <ComparePanes
        divider="vs"
        before={{
          label: 'Without client memory',
          text: without,
          note: 'No previous client decisions were used.',
        }}
        after={{
          label: 'With Hindsight memory',
          icon: 'layers',
          text: with_,
          note: `Grounded in ${memoryCount} recalled memor${memoryCount === 1 ? 'y' : 'ies'}.`,
        }}
      />
    </section>
  );
}
