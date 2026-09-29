import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { MemoryStatusBadge } from '../components/MemoryStatusBadge';
import { Icon, Logo, type IconName } from '../components/Icon';
import { ClientAvatar } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { MemoryHealthProvider } from '../hooks/useMemoryHealth';
import { clients } from '../services/clientos';
import type { ClientSummary } from '../types/api';

/**
 * Persistent chrome.
 *
 * Sidebar: WHICH client (the product's top-level object). Top bar: where you are
 * and whether memory is reachable. Client tabs: WHAT you are doing with that
 * client. The active project travels with you between the client's screens, so
 * switching from the workspace to the AI workspace never silently changes the
 * project in context.
 */
export function AppShell() {
  const { clientId } = useParams();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  // Refetched when the client in the URL changes, so a newly created client
  // appears in the sidebar as soon as ClientOS navigates to it.
  const clientList = useAsync((s) => clients.list(s), [clientId]);
  const activeClient = clientId
    ? clientList.data?.clients.find((c) => c.slug === clientId || c.id === clientId)
    : undefined;

  // Any navigation closes the mobile drawer.
  useEffect(() => setNavOpen(false), [location.pathname]);

  const sidebar = (
    <Sidebar
      clients={clientList.data?.clients}
      loading={clientList.loading && !clientList.data}
      failed={clientList.error !== null && !clientList.data}
      onRetry={clientList.reload}
      activeClientId={activeClient?.id}
    />
  );

  return (
    // One memory-health probe for the header and every page beneath it.
    <MemoryHealthProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <a
          href="#main"
          className="sr-only-focusable fixed left-3 top-3 z-[60] rounded-lg bg-ink px-3 py-2 text-sm text-white"
        >
          Skip to content
        </a>

        <aside className="sticky top-0 hidden h-dvh border-r border-line lg:block">{sidebar}</aside>

        <MobileDrawer open={navOpen} onClose={() => setNavOpen(false)}>{sidebar}</MobileDrawer>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
            <div className="flex h-12 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:h-[3.25rem] lg:px-8">
              <button
                type="button"
                className="btn-ghost btn-icon -ml-1.5 lg:hidden"
                onClick={() => setNavOpen(true)}
                aria-label="Open navigation"
                aria-expanded={navOpen}
                aria-controls="mobile-navigation"
              >
                <Icon name="menu" className="h-5 w-5" />
              </button>
              <Link to="/" className="flex items-center gap-2 rounded-md lg:hidden">
                <Logo className="h-6 w-6" />
                <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">ClientOS</span>
              </Link>
              <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-line-strong sm:block lg:hidden" />

              <Breadcrumbs client={activeClient} clientId={clientId} />

              {/* Desktop: the client's sections sit in the same row as the breadcrumb. */}
              {clientId && (
                <>
                  <span aria-hidden="true" className="ml-1 hidden h-5 w-px bg-line-strong lg:block" />
                  <ClientSectionNav clientId={clientId} inline />
                </>
              )}

              <div className="ml-auto min-w-0">
                <MemoryStatusBadge />
              </div>
            </div>

            {clientId && <ClientSectionNav clientId={clientId} />}
          </header>

          <main id="main" tabIndex={-1} className="flex-1 px-4 pb-16 pt-5 outline-none sm:px-6 sm:pt-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </MemoryHealthProvider>
  );
}

/* ── Sidebar ───────────────────────────────────────────────────────────── */

function Sidebar({
  clients: list, loading, failed, onRetry, activeClientId,
}: {
  clients: ClientSummary[] | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  activeClientId: string | undefined;
}) {
  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link to="/" className="flex items-center gap-2.5 rounded-md">
          <Logo />
          <span className="leading-none">
            <span className="block text-[0.9375rem] font-semibold tracking-tight text-ink">ClientOS</span>
            <span className="mt-1 block text-2xs text-ink-muted">Client decision memory</span>
          </span>
        </Link>
      </div>

      <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 pt-3">
        <SidebarLink to="/" end icon="overview">Overview</SidebarLink>

        <p className="eyebrow mb-1.5 mt-6 px-2.5">Clients</p>
        {loading && (
          <div className="space-y-1.5 px-2.5 py-1" aria-hidden="true">
            <div className="skeleton h-5 w-3/4" />
            <div className="skeleton h-5 w-2/3" />
          </div>
        )}
        {failed && (
          <div className="px-2.5 py-1 text-xs text-ink-muted">
            Clients could not be loaded.{' '}
            <button type="button" className="link" onClick={onRetry}>Retry</button>
          </div>
        )}
        {list && (
          <ul className="space-y-0.5">
            {list.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/clients/${c.slug}`}
                  aria-current={c.id === activeClientId ? 'true' : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                    c.id === activeClientId
                      ? 'bg-ink/[0.06] font-medium text-ink'
                      : 'text-ink-soft hover:bg-ink/[0.04] hover:text-ink'
                  }`}
                >
                  <ClientAvatar name={c.name} size="sm" />
                  <span className="truncate">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {list && list.length === 0 && <p className="px-2.5 text-xs text-ink-muted">No clients yet.</p>}
      </nav>

      <div className="shrink-0 border-t border-line px-5 py-4">
        <p className="flex items-start gap-2 text-2xs leading-relaxed text-ink-muted">
          <Icon name="layers" className="mt-px h-3.5 w-3.5 text-ink-faint" />
          <span>
            Memory is stored in Hindsight. Application data is stored in PostgreSQL. Demo data is
            synthetic.
          </span>
        </p>
      </div>
    </div>
  );
}

function SidebarLink({
  to, end, icon, children,
}: { to: string; end?: boolean; icon: IconName; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
          isActive ? 'bg-ink/[0.06] font-medium text-ink' : 'text-ink-soft hover:bg-ink/[0.04] hover:text-ink'
        }`
      }
    >
      <Icon name={icon} className="h-4 w-4 text-ink-muted" />
      {children}
    </NavLink>
  );
}

/* ── Top bar ───────────────────────────────────────────────────────────── */

const SECTIONS: Array<{ path: string; label: string; icon: IconName; end?: boolean }> = [
  { path: '', label: 'Workspace', icon: 'workspace', end: true },
  { path: '/ai', label: 'AI Workspace', icon: 'compass' },
  { path: '/memory', label: 'Memory timeline', icon: 'history' },
];

function Breadcrumbs({ client, clientId }: { client: ClientSummary | undefined; clientId: string | undefined }) {
  const { pathname } = useLocation();
  if (!clientId) {
    return (
      <p className="hidden text-sm font-medium text-ink sm:block lg:ml-0">
        {pathname === '/' ? 'Overview' : ''}
      </p>
    );
  }
  // Subtle: the page itself names the client and project. The section is named
  // by the tabs beside this, so it is not repeated here.
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block sm:pl-1 lg:pl-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[0.8125rem]">
        <li className="shrink-0">
          <Link to="/" className="rounded text-ink-muted transition-colors hover:text-ink">Clients</Link>
        </li>
        <li aria-hidden="true" className="text-ink-faint">/</li>
        <li className="min-w-0" aria-current="page">
          {client ? (
            <span className="block truncate font-medium text-ink-soft">{client.name}</span>
          ) : (
            <span className="skeleton inline-block h-4 w-24 align-middle" />
          )}
        </li>
      </ol>
    </nav>
  );
}

function ClientSectionNav({ clientId, inline = false }: { clientId: string; inline?: boolean }) {
  const [params] = useSearchParams();
  const project = params.get('project');
  // Keep the project in context when moving between this client's screens.
  const search = project ? `?project=${encodeURIComponent(project)}` : '';

  if (inline) {
    return (
      <nav aria-label="Client sections" className="-mb-px hidden self-stretch lg:flex">
        <ul className="flex gap-5">
          {SECTIONS.map((s) => (
            <li key={s.path} className="flex">
              <NavLink
                to={`/clients/${clientId}${s.path}${search}`}
                end={s.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 border-b-2 pt-0.5 text-[0.8125rem] font-medium transition-colors ${
                    isActive
                      ? 'border-ink text-ink'
                      : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink'
                  }`
                }
              >
                <Icon name={s.icon} className="h-4 w-4" />
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Client sections" className="px-4 sm:px-6 lg:hidden">
      <ul className="-mb-px flex gap-1 sm:gap-4">
        {SECTIONS.map((s) => (
          <li key={s.path} className="min-w-0 flex-1 sm:flex-none">
            <NavLink
              to={`/clients/${clientId}${s.path}${search}`}
              end={s.end}
              className={({ isActive }) =>
                `flex items-center justify-center gap-1.5 border-b-2 px-1 pb-2.5 pt-1 text-[0.8125rem] font-medium transition-colors sm:justify-start ${
                  isActive
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink'
                }`
              }
            >
              <Icon name={s.icon} className="hidden h-4 w-4 sm:block" />
              <span className="truncate">{s.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── Mobile drawer ─────────────────────────────────────────────────────── */

/**
 * The sidebar as an off-canvas dialog below the desktop breakpoint. Escape and
 * the backdrop close it; focus moves in on open and back to the trigger on close.
 */
function MobileDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      trigger?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 animate-overlay-in bg-ink/30" onMouseDown={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] animate-drawer-in border-r border-line shadow-overlay"
      >
        {children}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="btn-ghost btn-icon absolute right-2 top-3"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
