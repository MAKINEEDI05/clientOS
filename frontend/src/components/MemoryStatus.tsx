import type { ReactNode } from 'react';
import type { RelevantMemory } from '../lib/memoryCounts';
import type { MemoryAvailability } from '../hooks/useMemoryHealth';
import { Icon } from './Icon';
import { StatusDot, type StatusTone } from './ui';

/**
 * THE memory status for a client screen: whether this client's Hindsight memory
 * is in play, and how much of it the active project can draw on.
 *
 * Four display states. "Reachable but switched off" is distinct from "active" —
 * claiming active there would contradict the switch. And "still checking" is
 * distinct from "unavailable", which is the whole point of three-valued input.
 *
 * The count is how much memory is AVAILABLE to the project — its own decisions
 * plus the client-wide ones. It is not the number recalled for a given request,
 * which is a smaller, separate figure shown on a result itself.
 */
type DisplayState = 'checking' | 'unavailable' | 'active' | 'off';

const TONE: Record<DisplayState, { box: string; text: string; dot: StatusTone }> = {
  active: { box: 'border-memory-line bg-memory-soft/60', text: 'text-memory', dot: 'memory' },
  off: { box: 'border-line bg-paper-sunken/70', text: 'text-ink-soft', dot: 'off' },
  checking: { box: 'border-line bg-paper', text: 'text-ink-muted', dot: 'checking' },
  unavailable: { box: 'border-reject-line bg-reject-soft/50', text: 'text-reject', dot: 'bad' },
};

export interface MemoryStatusProps {
  clientName: string;
  /** Memories available to the active project; null while that is still loading. */
  memoryCount: number | null;
  /** Breakdown of the count into project and client-wide memory, when known. */
  relevant?: RelevantMemory;
  interactionCount?: number;
  /** Three-valued on purpose: "checking" must not be reported as an outage. */
  memoryAvailability: MemoryAvailability;
  /** Whether the user has memory switched on for the current request. */
  memoryEnabled?: boolean;
  /**
   * The client's Hindsight bank. Shown behind a disclosure so the memory this
   * client is backed by is checkable, without putting an identifier in the
   * headline. Never a credential — the bank id is not a secret.
   */
  bankId?: string | null;
}

export function MemoryStatus({
  variant, footer, ...props
}: MemoryStatusProps & {
  /** `panel`: a self-contained block beside a header. `strip`: a row within the page. */
  variant: 'panel' | 'strip';
  /** Extra line under the strip — the memory boundary, when the page states it. */
  footer?: ReactNode;
}) {
  const state: DisplayState =
    props.memoryAvailability === 'checking'
      ? 'checking'
      : props.memoryAvailability === 'unavailable'
        ? 'unavailable'
        : (props.memoryEnabled ?? true)
          ? 'active'
          : 'off';
  const t = TONE[state];

  const label = (
    <span className={`flex items-center gap-2 text-sm font-medium ${t.text}`}>
      <StatusDot tone={t.dot} />
      {state === 'checking'
        ? 'Checking client memory…'
        : state === 'active'
          ? `Using ${props.clientName}'s Hindsight memory`
          : state === 'off'
            ? 'Client memory is off for this request'
            : 'Client memory is temporarily unavailable'}
    </span>
  );

  if (variant === 'panel') {
    return (
      <div className={`w-full rounded-lg border px-3.5 py-3 transition-colors md:w-auto md:min-w-[18rem] md:max-w-sm ${t.box}`}>
        {label}
        <div className="mt-1.5 space-y-0.5 pl-4">
          <CountLine {...props} />
          <BreakdownLine relevant={props.relevant} />
          {props.bankId && (
            <details className="group pt-1">
              <DetailsSummary />
              <BankDetails bankId={props.bankId} className="mt-1.5" />
            </details>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="surface">
      <div className="flex flex-col gap-1.5 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:gap-5">
        <span className="shrink-0">{label}</span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 pl-4 lg:border-l lg:border-line lg:pl-5">
          <CountLine {...props} />
          {props.relevant && props.relevant.total > 0 && <span aria-hidden="true" className="hidden text-ink-faint lg:inline">·</span>}
          <BreakdownLine relevant={props.relevant} />
        </div>
        {props.bankId && (
          <details className="group relative pl-4 lg:ml-auto lg:pl-0">
            <DetailsSummary />
            <div className="absolute left-0 z-20 mt-2 w-[min(19rem,calc(100vw-3rem))] animate-fade-in rounded-lg border border-line bg-paper p-3 shadow-raised lg:left-auto lg:right-0">
              <BankDetails bankId={props.bankId} />
            </div>
          </details>
        )}
      </div>
      {footer && (
        <div className="rounded-b-xl border-t border-line-soft bg-paper-sunken/50 px-4 py-2.5 sm:px-5">{footer}</div>
      )}
    </div>
  );
}

function CountLine({ memoryCount, interactionCount }: MemoryStatusProps) {
  return (
    <p
      className="text-xs tabular-nums text-ink-muted"
      title="Decisions ClientOS has recorded for this project, including client-wide ones. A recommendation reports separately how many memory items Hindsight recalled for it."
    >
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
  );
}

/** Why the number is what it is. Both figures come from the memories themselves. */
function BreakdownLine({ relevant }: { relevant?: RelevantMemory }) {
  if (!relevant || relevant.total === 0) return null;
  return (
    <p className="text-xs leading-relaxed text-ink-muted">
      {relevant.project} project decision{relevant.project === 1 ? '' : 's'}
      {' + '}
      {relevant.clientWide} client-wide
    </p>
  );
}

function DetailsSummary() {
  return (
    <summary className="disclosure text-2xs">
      <Icon name="chevron-right" className="h-3 w-3 transition-transform group-open:rotate-90" />
      Memory system details
    </summary>
  );
}

function BankDetails({ bankId, className = '' }: { bankId: string; className?: string }) {
  return (
    <p className={`text-2xs leading-relaxed text-ink-muted ${className}`}>
      Hindsight bank{' '}
      <span className="break-all rounded bg-paper-sunken px-1 font-mono text-ink-soft">{bankId}</span>
      <br />
      One bank per client. This project's memories are tagged inside it.
    </p>
  );
}
