/**
 * Compact client/project identity with live memory status.
 *
 * Sits at the top of the AI workspace so it is always clear whose memory is in
 * play — which is also what makes client isolation demonstrable. Nothing about
 * the memory layer's internals is exposed.
 */
export function ClientContextBar({
  clientName, projectName, memoryCount, interactionCount, memoryConnected, memoryEnabled = true,
}: {
  clientName: string;
  projectName?: string | null;
  memoryCount: number;
  interactionCount?: number;
  /** Whether this client's memory can be reached at all. */
  memoryConnected: boolean;
  /** Whether the user has memory switched on for the current request. */
  memoryEnabled?: boolean;
}) {
  // Reachable but switched off is a third state. Showing "active" there would
  // contradict the toggle and imply history is in play when it is not.
  const state = !memoryConnected ? 'unavailable' : memoryEnabled ? 'active' : 'off';
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-black/[0.08] pb-4">
      <div className="min-w-0">
        <h1 className="font-display text-[1.75rem] leading-tight tracking-tight text-ink">
          {clientName}
        </h1>
        {projectName && (
          <p className="mt-0.5 text-sm text-ink-muted">{projectName}</p>
        )}
      </div>

      <div className="flex flex-col gap-1 sm:items-end">
        <span
          className={`inline-flex items-center gap-1.5 text-sm font-medium ${
            state === 'active' ? 'text-approve' : state === 'off' ? 'text-ink-muted' : 'text-reject'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              state === 'active' ? 'bg-approve' : state === 'off' ? 'bg-ink-muted/50' : 'bg-reject'
            }`}
          />
          {state === 'active'
            ? 'Client memory active'
            : state === 'off'
              ? 'Client memory off for this request'
              : 'Client memory unavailable'}
        </span>
        <span className="text-xs tabular-nums text-ink-muted">
          {memoryCount} memor{memoryCount === 1 ? 'y' : 'ies'}
          {interactionCount !== undefined && (
            <> · {interactionCount} interaction{interactionCount === 1 ? '' : 's'}</>
          )}
        </span>
      </div>
    </div>
  );
}
