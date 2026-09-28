import { Icon } from './Icon';

/**
 * Honest waiting state while the recommendation is generated.
 *
 * A recommendation is ONE round trip: recall, reasoning and evidence binding all
 * happen inside a single backend call. The browser therefore cannot observe when
 * any individual phase finishes — so this deliberately makes no progress claim.
 * No ticks, no percentages, no elapsed timer, no stages advancing on a guess.
 * The bar along the top is indeterminate: it says "working", never "how far".
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
      className="surface relative animate-fade-in overflow-hidden px-5 py-5 sm:px-6"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-line-soft">
        <span
          className={`block h-full w-1/3 animate-indeterminate rounded-full ${
            useMemory ? 'bg-memory-bright' : 'bg-ink-faint'
          }`}
        />
      </span>

      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
            useMemory ? 'bg-memory-soft text-memory' : 'bg-ink/[0.05] text-ink-muted'
          }`}
        >
          <Icon name={useMemory ? 'layers' : 'compass'} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
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
          {/* The shape of the answer to come — placeholders, not claims. */}
          <div aria-hidden="true" className="mt-4 space-y-2.5">
            <div className="skeleton h-3 w-11/12" />
            <div className="skeleton h-3 w-4/5" />
            <div className="skeleton h-3 w-3/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
