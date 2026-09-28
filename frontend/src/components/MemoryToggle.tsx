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
  memoryCount: number;
  disabled?: boolean;
  memoryAvailability: MemoryAvailability;
}) {
  const checking = memoryAvailability === 'checking';
  const unavailable = memoryAvailability === 'unavailable';
  const on = enabled && !unavailable && !checking;

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl px-3.5 py-3 transition-colors ${
        unavailable
          ? 'bg-reject-soft/40'
          : on
            ? 'bg-approve-soft/50'
            : 'bg-paper-sunken'
      } ${disabled || unavailable || checking ? 'cursor-not-allowed' : ''}`}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled || unavailable || checking}
        className="sr-only"
      />

      {/* Switch */}
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          on ? 'bg-approve' : unavailable ? 'bg-reject/40' : 'bg-ink-muted/30'
        } ${checking ? 'animate-pulse' : ''}`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            on ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-ink">
            Client memory{' '}
            <span className={unavailable ? 'text-reject' : on ? 'text-approve' : 'text-ink-muted'}>
              {checking ? 'checking…' : unavailable ? 'unavailable' : on ? 'ON' : 'OFF'}
            </span>
          </span>
        </span>

        <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">
          {checking
            ? 'Checking whether this client’s memory can be reached…'
            : unavailable
              ? "This client’s memory cannot be reached, so previous decisions cannot be used."
              : on
                ? `Recall ${clientName}’s previous decisions from Hindsight and ground this direction in them.`
                : 'Generate without previous client decisions.'}
        </span>

        {!unavailable && !checking && (
          <span className="mt-1 block text-xs tabular-nums text-ink-muted">
            {on
              ? `${memoryCount} memor${memoryCount === 1 ? 'y' : 'ies'} available to this project`
              : `${memoryCount} available memor${memoryCount === 1 ? 'y' : 'ies'} will be ignored`}
          </span>
        )}
      </span>
    </label>
  );
}
