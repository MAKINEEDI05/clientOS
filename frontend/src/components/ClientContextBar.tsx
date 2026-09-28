import type { ReactNode } from 'react';
import type { RelevantMemory } from '../lib/memoryCounts';
import type { MemoryAvailability } from '../hooks/useMemoryHealth';
import { Icon } from './Icon';
import { ClientAvatar, StatusDot, type StatusTone } from './ui';

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
  showClientName = true, projectDescription,
}: {
  clientName: string;
  projectName?: string | null;
  /** The shared active-project control, when this screen should offer one. */
  projectControl?: ReactNode;
  /** Memories available to the active project; null while that is still loading. */
  memoryCount: number | null;
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
  /** The active project's own description, when it has one. */
  projectDescription?: string | null;
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

  const tone: Record<typeof state, { box: string; text: string; dot: StatusTone }> = {
    active: { box: 'border-memory-line bg-memory-soft/60', text: 'text-memory', dot: 'memory' },
    off: { box: 'border-line bg-paper-sunken/70', text: 'text-ink-soft', dot: 'off' },
    checking: { box: 'border-line bg-paper', text: 'text-ink-muted', dot: 'checking' },
    unavailable: { box: 'border-reject-line bg-reject-soft/50', text: 'text-reject', dot: 'bad' },
  };
  const t = tone[state];

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
      <div className="min-w-0 flex-1">
        {showClientName && (
          <div className="flex items-center gap-3">
            <ClientAvatar name={clientName} size="lg" />
            <h1 className="page-title min-w-0">{clientName}</h1>
          </div>
        )}
        {projectControl ? (
          <div className={showClientName ? 'mt-4' : ''}>{projectControl}</div>
        ) : (
          projectName && (
            showClientName ? (
              <p className="mt-0.5 text-sm text-ink-muted">{projectName}</p>
            ) : (
              <div className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-memory-soft text-memory">
                  <Icon name="folder" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="eyebrow">Active project</p>
                  <h2 className="truncate text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-ink">
                    {projectName}
                  </h2>
                </div>
              </div>
            )
          )
        )}
        {projectDescription && (
          <p className={`mt-2 max-w-xl text-[0.8125rem] leading-relaxed text-ink-muted ${showClientName ? '' : 'md:pl-[2.625rem]'}`}>
            {projectDescription}
          </p>
        )}
      </div>

      <div className={`w-full rounded-lg border px-3.5 py-3 transition-colors md:w-auto md:min-w-[18rem] md:max-w-sm ${t.box}`}>
        <span className={`flex items-center gap-2 text-sm font-medium ${t.text}`}>
          <StatusDot tone={t.dot} />
          {state === 'checking'
            ? 'Checking client memory…'
            : state === 'active'
              ? `Using ${clientName}'s Hindsight memory`
              : state === 'off'
                ? 'Client memory is off for this request'
                : 'Client memory is temporarily unavailable'}
        </span>
        <div className="mt-1.5 space-y-0.5 pl-4">
          <p className="text-xs tabular-nums text-ink-muted">
            {memoryCount === null ? (
              "Loading this project's memory…"
            ) : (
              <>
                {memoryCount} memor{memoryCount === 1 ? 'y' : 'ies'} available to this project
                {interactionCount !== undefined && (
                  <> · {interactionCount} interaction{interactionCount === 1 ? '' : 's'}</>
                )}
              </>
            )}
          </p>
          {/* Why the number is what it is: this project's decisions plus the
              client-wide ones. Both figures come from the memories themselves. */}
          {relevant && relevant.total > 0 && (
            <p className="text-xs leading-relaxed text-ink-muted">
              {relevant.project} project decision{relevant.project === 1 ? '' : 's'}
              {' + '}
              {relevant.clientWide} client-wide
            </p>
          )}

          {bankId && (
            <details className="group pt-1">
              <summary className="disclosure text-2xs">
                <Icon name="chevron-right" className="h-3 w-3 transition-transform group-open:rotate-90" />
                Memory system details
              </summary>
              <p className="mt-1.5 text-2xs leading-relaxed text-ink-muted">
                Hindsight bank{' '}
                <span className="break-all rounded bg-paper/80 px-1 font-mono text-ink-soft">{bankId}</span>
                <br />
                One bank per client. This project's memories are tagged inside it.
              </p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
