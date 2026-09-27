/**
 * Client-memory switch.
 *
 * States what will actually happen in each position, and never implies memory
 * was used when it was not. The available-memory count is read from real data.
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

  return (
    <div
      className={`rounded-xl border p-3.5 transition-colors ${
        enabled && !unavailable
          ? 'border-approve/25 bg-approve-soft/30'
          : 'border-black/[0.07] bg-paper-sunken'
      }`}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled || unavailable}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#1f5136] disabled:cursor-not-allowed"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">Client memory</span>
            <span
              className={`text-xs font-semibold ${
                unavailable ? 'text-reject' : enabled ? 'text-approve' : 'text-ink-muted'
              }`}
            >
              {unavailable ? '○ UNAVAILABLE' : enabled ? '● ON' : '○ OFF'}
            </span>
          </span>

          <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
            {unavailable
              ? 'This client’s memory cannot be reached, so recommendations cannot be grounded in past decisions.'
              : enabled
                ? `Ground this recommendation in ${clientName}’s previous decisions.`
                : 'Generate without previous client decisions.'}
          </span>

          {!unavailable && (
            <span className="mt-1 block text-xs tabular-nums text-ink-muted">
              {enabled
                ? `${memoryCount} memor${memoryCount === 1 ? 'y' : 'ies'} available to draw on`
                : `${memoryCount} memor${memoryCount === 1 ? 'y' : 'ies'} will be ignored`}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}
