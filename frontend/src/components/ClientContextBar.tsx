import { isBroadScope } from '../lib/scope';

/**
 * Whose memory is in play, and how much of it.
 *
 * Kept visible in the workspaces so it is always obvious which client's memory
 * the agent is reasoning over — which is also what makes client isolation
 * demonstrable rather than merely asserted.
 */
export function ClientContextBar({
  clientName, projectName, memoryCount, interactionCount, memoryConnected,
}: {
  clientName: string;
  projectName?: string | null;
  memoryCount: number;
  interactionCount?: number;
  memoryConnected: boolean;
}) {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
      <div className="min-w-0">
        <p className="font-display text-base leading-tight text-ink">{clientName}</p>
        {projectName && <p className="mt-0.5 text-sm text-ink-muted">{projectName}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span
          className={`inline-flex items-center gap-1.5 font-medium ${
            memoryConnected ? 'text-approve' : 'text-reject'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${memoryConnected ? 'bg-approve' : 'bg-reject'}`}
          />
          {memoryConnected ? 'Client memory active' : 'Client memory unavailable'}
        </span>
        <span className="tabular-nums text-ink-muted">
          {memoryCount} memor{memoryCount === 1 ? 'y' : 'ies'}
        </span>
        {interactionCount !== undefined && (
          <span className="tabular-nums text-ink-muted">
            {interactionCount} interaction{interactionCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  );
}

export { isBroadScope };
