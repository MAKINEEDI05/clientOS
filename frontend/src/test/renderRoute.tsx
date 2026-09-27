import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

/**
 * Render one page at a real route.
 *
 * A memory router is used rather than a bare component so the page's own URL
 * handling is exercised — the active project lives in `?project=`, so a test
 * that bypassed the router would not be testing the real mechanism.
 */
export function renderRoute(path: string, element: ReactElement, initialEntry: string) {
  const router = createMemoryRouter([{ path, element }], { initialEntries: [initialEntry] });
  const utils = render(<RouterProvider router={router} />);
  return { ...utils, router, search: () => router.state.location.search };
}
