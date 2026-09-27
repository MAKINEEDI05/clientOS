import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProjectSummary } from '../types/api';

/**
 * Which project the workspace is looking at.
 *
 * Held in the URL (`?project=<slug>`) rather than in app state: it survives a
 * refresh, it is shareable, and it keeps the three client screens in agreement
 * without introducing a store.
 */
export function useActiveProject(projects: ProjectSummary[] | undefined) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('project');

  const active = useMemo(() => {
    if (!projects || projects.length === 0) return null;
    const match = projects.find((p) => p.slug === requested || p.id === requested);
    return match ?? projects[0] ?? null;
  }, [projects, requested]);

  const setActive = useCallback(
    (slug: string) => {
      const next = new URLSearchParams(params);
      next.set('project', slug);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  return { activeProject: active, activeProjectId: active?.id ?? '', setActiveProject: setActive };
}
