import { Icon } from './Icon';
import type { ProjectSummary } from '../types/api';

/**
 * The shared active-project control.
 *
 * ClientOS has ONE active project per client, held in the URL by
 * `useActiveProject`. This is the compact presentation of that single piece of
 * state, reused wherever the project in context has to be obvious (the AI
 * workspace and the memory timeline) — it holds no state of its own, so it can
 * never disagree with the primary switcher in the client workspace.
 */
export function ProjectContextSelector({
  projects, activeId, onSelect, label = 'Project', id = 'project-context',
}: {
  projects: ProjectSummary[];
  activeId: string;
  onSelect: (slug: string) => void;
  label?: string;
  id?: string;
}) {
  const active = projects.find((p) => p.id === activeId);

  // With a single project there is nothing to choose. Naming it is still useful;
  // offering a one-option dropdown is not.
  if (projects.length < 2) {
    return (
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <p className="mt-1 flex items-center gap-2 truncate text-[0.9375rem] font-medium text-ink">
          <Icon name="folder" className="h-4 w-4 text-memory" />
          {active?.name ?? '—'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="eyebrow block">{label}</label>
      <div className="relative mt-1.5 w-full sm:w-auto sm:max-w-xs">
        <Icon
          name="folder"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-memory"
        />
        <select
          id={id}
          className="select w-full truncate py-2 pl-9 text-[0.9375rem] font-medium sm:min-w-[16rem]"
          value={active?.slug ?? ''}
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
    </div>
  );
}
