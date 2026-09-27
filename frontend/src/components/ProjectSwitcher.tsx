import type { ProjectSummary } from '../types/api';

/** Switch between a client's projects, and add another. */
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
        <>
          <label htmlFor="project-switch" className="sr-only">Active project</label>
          <select
            id="project-switch"
            className="input max-w-xs"
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
        </>
      ) : (
        <div role="tablist" aria-label="Projects" className="flex flex-wrap gap-1.5">
          {projects.map((p) => {
            const isActive = p.id === activeId;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => onSelect(p.slug)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-muted hover:bg-paper-sunken hover:text-ink'
                }`}
              >
                {p.name}
                {p.openConflicts > 0 && (
                  <span className="ml-1.5 rounded-full bg-caution-soft px-1.5 py-0.5 text-[0.625rem] text-caution">
                    {p.openConflicts}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <button type="button" className="btn-ghost px-2.5 py-1.5 text-sm" onClick={onAdd}>
        + Add project
      </button>
    </div>
  );
}
