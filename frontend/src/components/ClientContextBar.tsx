import type { RelevantMemory } from '../lib/memoryCounts';
import type { MemoryAvailability } from '../hooks/useMemoryHealth';

/**
 * Compact client/project identity, and THE memory status for the screen.
 *
 * Sits at the top of the AI workspace so it is always clear whose memory is in
 * play, and — since one client can have several projects — WHICH project's. The
 * project control is passed in rather than built here, so every screen drives the
 * same active-project state.
 *
 * This is deliberately the only *status* claim on the page. The memory switch
 * below is a control (its label is the switch position), and the chip on a result
 * describes that result. Three things, three different jobs, no competing claims.
 *
 * The count here is how much memory is AVAILABLE to this project — its own
 * decisions plus the client-wide ones. It is not the number recalled for a given
 * request, which is a smaller and separate figure shown on the result itself.
 */
export function ClientContextBar({
  clientName, projectName, projectControl, memoryCount, relevant,
  interactionCount, memoryAvailability, memoryEnabled = true, bankId,
  showClientName = true,
}: {
  clientName: string;
  projectName?: string | null;
  /** The shared active-project control, when this screen should offer one. */
  projectControl?: React.ReactNode;
  memoryCount: number;
  /** Breakdown of the count into project and client-wide memory, when known. */
  relevant?: RelevantMemory;
  interactionCount?: number;
  /**
   * Whether this client's memory can be reached. Three-valued on purpose:
   * "checking" must not be reported as an outage.
   */
  memoryAvailability: MemoryAvailability;
  /** Whether the user has memory switched on for the current request. */
  memoryEnabled?: boolean;
  /**
   * The client's Hindsight bank. Shown behind a disclosure so the memory this
   * client is backed by is checkable, without putting an identifier in the
   * headline. Never a credential — the bank id is not a secret.
   */
  bankId?: string | null;
  /**
   * False where the page already heads with the client's name, so it is not
   * announced twice. The name is still used in the status line, which needs it.
   */
  showClientName?: boolean;
}) {
  // Four display states. "Reachable but switched off" is distinct from "active"
  // — claiming active there would contradict the switch. And "still checking" is
  // distinct from "unavailable", which is the whole point of three-valued input.
  const state =
    memoryAvailability === 'checking'
      ? 'checking'
      : memoryAvailability === 'unavailable'
        ? 'unavailable'
        : memoryEnabled
          ? 'active'
          : 'off';
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-black/[0.08] pb-4">
      <div className="min-w-0">
        {showClientName && (
          <h1 className="font-display text-[1.75rem] leading-tight tracking-tight text-ink">
            {clientName}
          </h1>
        )}
        {projectControl ? (
          <div className={showClientName ? 'mt-2' : ''}>{projectControl}</div>
        ) : (
          projectName && (
            <p
              className={
                showClientName
                  ? 'mt-0.5 text-sm text-ink-muted'
                  : 'font-display text-lg leading-tight tracking-tight text-ink'
              }
            >
              {projectName}
            </p>
          )
        )}
      </div>

      <div className="flex flex-col gap-1 sm:items-end">
        <span
          className={`inline-flex items-center gap-1.5 text-sm font-medium ${
            state === 'active'
              ? 'text-approve'
              : state === 'unavailable'
                ? 'text-reject'
                : 'text-ink-muted'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              state === 'active'
                ? 'bg-approve'
                : state === 'unavailable'
                  ? 'bg-reject'
                  : state === 'checking'
                    ? 'animate-pulse bg-ink-muted/60'
                    : 'bg-ink-muted/50'
            }`}
          />
          {state === 'checking'
            ? 'Checking client memory…'
            : state === 'active'
              ? `Using ${clientName}'s Hindsight memory`
              : state === 'off'
                ? 'Client memory is off for this request'
                : 'Client memory is temporarily unavailable'}
        </span>
        <span className="text-xs tabular-nums text-ink-muted">
          {memoryCount} memor{memoryCount === 1 ? 'y' : 'ies'} available to this project
          {interactionCount !== undefined && (
            <> · {interactionCount} interaction{interactionCount === 1 ? '' : 's'}</>
          )}
        </span>
        {/* Why the number is what it is: this project's decisions plus the
            client-wide ones. Both figures come from the memories themselves. */}
        {relevant && relevant.total > 0 && (
          <span className="max-w-xs text-xs leading-relaxed text-ink-muted sm:text-right">
            {relevant.project} project decision{relevant.project === 1 ? '' : 's'}
            {' + '}
            {relevant.clientWide} client-wide
          </span>
        )}

        {bankId && (
          <details className="group mt-0.5 sm:text-right">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[0.6875rem] text-ink-muted transition-colors hover:text-ink-soft">
              <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">›</span>
              Memory system details
            </summary>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-muted sm:text-right">
              Hindsight bank{' '}
              <span className="break-all font-mono text-ink-soft">{bankId}</span>
              <br />
              One bank per client. This project's memories are tagged inside it.
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
