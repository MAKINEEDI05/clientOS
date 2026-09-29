import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { MemoryStatus, type MemoryStatusProps } from './MemoryStatus';
import { ClientIdentity } from './ui';

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
 * It opens with the same client identity line as the workspace, so moving between
 * the two screens reads as the same client, one step further on.
 */
export function ClientContextBar({
  clientName, projectName, projectControl, showClientName = true, projectDescription,
  ...status
}: MemoryStatusProps & {
  projectName?: string | null;
  /** The shared active-project control, when this screen should offer one. */
  projectControl?: ReactNode;
  /**
   * False where the page already heads with the client's name, so it is not
   * announced twice. The name is still used in the status line, which needs it.
   */
  showClientName?: boolean;
  /** The active project's own description, when it has one. */
  projectDescription?: string | null;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
      <div className="min-w-0 flex-1">
        {showClientName && <ClientIdentity name={clientName} as="h1" />}
        {projectControl ? (
          <div className={showClientName ? 'mt-3' : ''}>{projectControl}</div>
        ) : (
          projectName && (
            <p className={`flex items-center gap-2 text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink ${showClientName ? 'mt-2' : ''}`}>
              <Icon name="folder" className="h-4 w-4 text-memory" />
              {projectName}
            </p>
          )
        )}
        {projectDescription && (
          <p className="mt-2 max-w-xl text-[0.8125rem] leading-relaxed text-ink-muted">{projectDescription}</p>
        )}
      </div>

      <MemoryStatus variant="panel" clientName={clientName} {...status} />
    </div>
  );
}
