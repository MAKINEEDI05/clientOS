/**
 * Honest waiting state while the recommendation is generated.
 *
 * A recommendation is ONE round trip: recall, reasoning and evidence binding all
 * happen inside a single backend call. The browser therefore cannot observe when
 * any individual phase finishes — so this deliberately makes no progress claim.
 * No ticks, no percentages, no elapsed timer, no stages advancing on a guess.
 *
 * What it does say is what the request will actually do, which differs by memory
 * setting and is known for certain from the request itself.
 */
export function GenerationProgress({
  useMemory, clientName,
}: {
  useMemory: boolean;
  clientName?: string;
}) {
  const who = clientName ?? 'this client';

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-black/[0.07] bg-paper px-5 py-4"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={`mt-[0.4rem] inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full ${
          useMemory ? 'bg-approve' : 'bg-ink-muted/60'
        }`}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {useMemory
            ? `Recalling ${who}'s decisions and writing a direction…`
            : 'Writing a direction…'}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
          {useMemory
            ? 'One request: ClientOS recalls the memories relevant to it, then grounds every point it can in them.'
            : 'Client memory is off, so no previous decision will be recalled or used.'}
        </p>
      </div>
    </div>
  );
}
