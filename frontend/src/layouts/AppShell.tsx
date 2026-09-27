import { NavLink, Outlet, useParams } from 'react-router-dom';
import { MemoryStatusBadge } from '../components/MemoryStatusBadge';

/** Persistent chrome: brand, client-scoped navigation, memory status. */
export function AppShell() {
  const { clientId } = useParams();

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only-focusable absolute left-3 top-3 z-50 rounded-lg bg-accent px-3 py-2 text-sm text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-black/[0.07] bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <NavLink to="/" className="group flex items-baseline gap-2">
            <span className="font-display text-lg font-semibold tracking-tight text-ink">ClientOS</span>
            <span className="hidden text-xs text-ink-muted sm:inline">
              remembers why your clients decide
            </span>
          </NavLink>

          {clientId && (
            <nav aria-label="Client sections" className="order-3 flex gap-1 sm:order-none">
              <TabLink to={`/clients/${clientId}`} end>Workspace</TabLink>
              <TabLink to={`/clients/${clientId}/ai`}>AI Workspace</TabLink>
              <TabLink to={`/clients/${clientId}/memory`}>Memory Timeline</TabLink>
            </nav>
          )}

          <div className="ml-auto">
            <MemoryStatusBadge />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <p className="border-t border-black/[0.06] pt-4 text-xs text-ink-muted">
          Memory is stored in Hindsight. Application data is stored in PostgreSQL. Demo data is synthetic.
        </p>
      </footer>
    </div>
  );
}

function TabLink({ to, end, children }: { to: string; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
          isActive ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-paper-sunken hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
