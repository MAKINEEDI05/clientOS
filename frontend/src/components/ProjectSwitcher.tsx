import { Icon } from './Icon';
import { handleTabListKeyDown } from './ui';
import type { ProjectSummary } from '../types/api';

/**
 * Switch between a client's projects, and add another.
 *
 * The active project is the one that decides which of the client's memories are
 * in play, so it is shown as a raised, labelled tab — never just a colour change.
 */
export function ProjectSwitcher({
  projects, activeId, onSelect, onAdd,
}: {
  projects: ProjectSummary[];
  activeId: string;
  onSelect: (slug: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {projects.length > 3 ? (
        <div className="relative w-full sm:w-auto">
          <label htmlFor="project-switch" className="sr-only">Active project</label>
          <Icon
            name="folder"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-memory"
          />
          <select
            id="project-switch"
            className="select w-full pl-9 font-medium sm:min-w-[18rem]"
            value={projects.find((p) => p.id === activeId)?.slug ?? ''}
            onChange={(e) => onSelect(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.name}
                {p.openConflicts > 0 ? ` (${p.openConflicts} to confirm)` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div
          role="tablist"
          aria-label="Projects"
          onKeyDown={handleTabListKeyDown}
          className="flex w-full flex-col gap-0.5 rounded-lg bg-ink/[0.05] p-0.5 sm:w-auto sm:max-w-full sm:flex-row sm:flex-wrap"
        >
          {projects.map((p) => {
            const isActive = p.id === activeId;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => onSelect(p.slug)}
                className={`inline-flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-[background-color,color,box-shadow] duration-150 sm:py-1.5 ${
                  isActive
                    ? 'bg-paper text-ink shadow-[0_1px_2px_rgba(31,27,18,0.08),0_0_0_1px_rgba(31,27,18,0.06)]'
                    : 'text-ink-muted hover:bg-paper/60 hover:text-ink'
                }`}
              >
                <Icon name="folder" className={`h-4 w-4 ${isActive ? 'text-memory' : 'text-ink-faint'}`} />
                <span className="truncate">{p.name}</span>
                {p.openConflicts > 0 && (
                  <span className="rounded-full bg-accent-soft px-1.5 text-2xs font-semibold tabular-nums text-accent">
                    {p.openConflicts}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <button type="button" className="btn-ghost btn-sm text-ink-muted" onClick={onAdd}>
        <Icon name="plus" className="h-3.5 w-3.5" />
        Add project
      </button>
    </div>
  );
}
