/**
 * Client-memory switch.
 *
 * States what will actually happen in each position. When off, the copy is
 * explicit that no previous decisions are used — the UI never implies otherwise.
 */
export function MemoryToggle({
  enabled, onChange, clientName, memoryCount, disabled, memoryConnected,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  clientName: string;
  memoryCount: number;
  disabled?: boolean;
  memoryConnected: boolean;
}) {
  const unavailable = !memoryConnected;
  const on = enabled && !unavailable;

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl px-3.5 py-3 transition-colors ${
        unavailable
          ? 'bg-reject-soft/40'
          : on
            ? 'bg-approve-soft/50'
            : 'bg-paper-sunken'
      } ${disabled || unavailable ? 'cursor-not-allowed' : ''}`}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled || unavailable}
        className="sr-only"
      />

      {/* Switch */}
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          on ? 'bg-approve' : unavailable ? 'bg-reject/40' : 'bg-ink-muted/30'
        }`}
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
              {unavailable ? 'unavailable' : on ? 'ON' : 'OFF'}
            </span>
          </span>
        </span>

        <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">
          {unavailable
            ? "This client’s memory cannot be reached, so previous decisions cannot be used."
            : on
              ? `Ground this direction in ${clientName}’s previous decisions.`
              : 'Generate without previous client decisions.'}
        </span>

        {!unavailable && (
          <span className="mt-1 block text-xs tabular-nums text-ink-muted">
            {on
              ? `${memoryCount} memor${memoryCount === 1 ? 'y' : 'ies'} available`
              : `${memoryCount} memor${memoryCount === 1 ? 'y' : 'ies'} will be ignored`}
          </span>
        )}
      </span>
    </label>
  );
}
