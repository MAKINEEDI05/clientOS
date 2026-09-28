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
      className="overflow-hidden rounded-2xl border border-black/[0.08] bg-paper shadow-card"
    >
      <div className="border-b border-black/[0.06] bg-paper-sunken px-5 py-3 sm:px-6">
        <h2 id="memory-comparison-heading" className="eyebrow">Memory changes the direction</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          The same request, answered without this client's history and with it.
        </p>
      </div>

      <div className="grid divide-y divide-black/[0.06] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Side
          label="Without client memory"
          tone="muted"
          note="No previous client decisions were used."
          text={without}
        />
        <Side
          label="With Hindsight memory"
          tone="accent"
          note={`Grounded in ${memoryCount} recalled memor${memoryCount === 1 ? 'y' : 'ies'}.`}
          text={with_}
        />
      </div>
    </section>
  );
}

function Side({
  label, text, note, tone,
}: {
  label: string;
  text: string;
  note: string;
  tone: 'muted' | 'accent';
}) {
  const isAccent = tone === 'accent';
  return (
    <div className={`px-5 py-4 sm:px-6 ${isAccent ? 'bg-approve-soft/20' : ''}`}>
      <p className={`eyebrow ${isAccent ? 'text-approve' : 'text-ink-muted'}`}>{label}</p>
      <p
        className={`mt-2 text-sm leading-relaxed ${
          isAccent ? 'font-medium text-ink' : 'text-ink-muted'
        }`}
      >
        {text}
      </p>
      <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-muted">{note}</p>
    </div>
  );
}
