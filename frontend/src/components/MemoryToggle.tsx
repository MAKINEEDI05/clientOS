import type { MemoryAvailability } from '../hooks/useMemoryHealth';

/**
 * Client-memory switch.
 *
 * States what will actually happen in each position. When off, the copy is
 * explicit that no previous decisions are used — the UI never implies otherwise.
 *
 * While availability is still being checked the switch is disabled and says so,
 * rather than presenting itself as unavailable. Disabling it is what stops a
 * request being sent against memory whose reachability is not yet known.
 */
export function MemoryToggle({
  enabled, onChange, clientName, memoryCount, disabled, memoryAvailability,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  clientName: string;
  /** Memories available to the active project; null while that is still loading. */
  memoryCount: number | null;
  disabled?: boolean;
  memoryAvailability: MemoryAvailability;
}) {
  const checking = memoryAvailability === 'checking';
  const unavailable = memoryAvailability === 'unavailable';
  const on = enabled && !unavailable && !checking;
  const locked = disabled || unavailable || checking;

  return (
    <label className={`group flex items-start gap-3 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        disabled={locked}
        className="peer sr-only"
      />

      {/* Switch. Focus is shown on the track, since the real input is hidden. */}
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-ring/70 peer-focus-visible:ring-offset-2 ${
          on ? 'bg-memory' : unavailable ? 'bg-reject/35' : 'bg-ink/20'
        } ${checking ? 'animate-pulse' : ''} ${!locked ? 'group-hover:brightness-95' : ''}`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-200 ${
            on ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">
          Client memory{' '}
          <span className={unavailable ? 'text-reject' : on ? 'text-memory' : 'font-medium text-ink-muted'}>
            {checking ? 'checking…' : unavailable ? 'unavailable' : on ? 'ON' : 'OFF'}
          </span>
        </span>

        <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-ink-soft">
          {checking
            ? 'Checking whether this client’s memory can be reached…'
            : unavailable
              ? "This client’s memory cannot be reached, so previous decisions cannot be used."
              : on
                ? `Recall ${clientName}’s previous decisions from Hindsight and ground this direction in them.`
                : 'Generate without previous client decisions.'}
        </span>

        {!unavailable && !checking && memoryCount !== null && (
          <span className="mt-0.5 block text-xs tabular-nums text-ink-muted">
            {on
              ? `${memoryCount} memor${memoryCount === 1 ? 'y' : 'ies'} available to this project`
              : `${memoryCount} available memor${memoryCount === 1 ? 'y' : 'ies'} will be ignored`}
          </span>
        )}
      </span>
    </label>
  );
}
