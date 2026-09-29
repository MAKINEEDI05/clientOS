import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAsync, useMutation } from '../hooks/useAsync';
import { clients } from '../services/clientos';
import { AddClientDialog } from '../components/AddClientDialog';
import { ErrorState, LoadingState } from '../components/States';
import { Icon, type IconName } from '../components/Icon';
import { ClientAvatar } from '../components/ui';
import { formatRelative } from '../lib/format';
import type { ClientSummary } from '../types/api';

/** Every memory a client holds, whatever its type. The client card's headline number. */
function totalMemory(c: ClientSummary): number {
  return Object.values(c.counts).reduce((sum, n) => sum + n, 0);
}

/** A one-time notice handed over by the page that navigated here, e.g. after a deletion. */
function readNotice(state: unknown): string | null {
  const notice = (state as { notice?: unknown } | null)?.notice;
  return typeof notice === 'string' ? notice : null;
}

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState<string | null>(() => readNotice(location.state));

  // Shown once: cleared from history so a refresh or Back does not repeat it.
  useEffect(() => {
    if (readNotice(location.state)) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, loading, error, reload } = useAsync((signal) => clients.list(signal), []);

  const create = useMutation(
    async (input: { name: string; description?: string; firstProjectName?: string }) => {
      const result = await clients.create(input);
      setDialogOpen(false);
      // Straight into the new client's workspace.
      navigate(`/clients/${result.client.slug}`);
      return result;
    },
  );

  const list = data?.clients ?? [];
  const hasClients = list.length > 0;
  const awaiting = list.filter((c) => c.openConflicts > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="eyebrow flex items-center gap-1.5 text-memory">
            <Icon name="layers" className="h-3.5 w-3.5" strokeWidth={2} />
            Client decision memory
          </p>
          <h1 className="page-title mt-2.5">Never lose the reason behind a client decision.</h1>
          <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-muted">
            ClientOS remembers what each client approved, rejected, required and changed their mind
            about, then brings that history into the next piece of work — so your team does not
            repeat an idea the client already turned down.
          </p>
        </div>
        {hasClients && (
          <button type="button" className="btn-primary shrink-0 self-start sm:self-auto" onClick={() => setDialogOpen(true)}>
            <Icon name="plus" className="h-4 w-4" />
            Add client
          </button>
        )}
      </header>

      {notice && (
        <div
          role="status"
          className="flex animate-fade-in items-center gap-3 rounded-xl border border-memory-line bg-memory-soft/60 px-4 py-3"
        >
          <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-memory text-white">
            <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium text-ink">{notice}</p>
          <button type="button" className="btn-ghost btn-sm -my-1 -mr-1.5 text-ink-muted" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading && <LoadingState label="Loading clients" />}
      {error !== null && <ErrorState error={error} onRetry={reload} />}

      {data && !hasClients && <Onboarding onCreate={() => setDialogOpen(true)} />}

      {data && hasClients && (
        <>
          <Overview clients={list} />

          {awaiting.length > 0 && (
            <section
              aria-labelledby="awaiting-heading"
              className="surface animate-fade-in overflow-hidden border-accent-line"
            >
              <div className="flex items-center gap-2 border-b border-accent-line/70 bg-accent-soft/50 px-4 py-2.5 sm:px-5">
                <Icon name="swap" className="h-4 w-4 text-accent" />
                <h2 id="awaiting-heading" className="text-[0.8125rem] font-semibold text-accent">
                  Preference changes awaiting your decision
                </h2>
              </div>
              <ul className="divide-y divide-line-soft">
                {awaiting.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <span className="flex min-w-0 items-center gap-2.5 text-sm">
                      <ClientAvatar name={c.name} size="sm" />
                      <span className="font-medium text-ink">{c.name}</span>
                      <span className="text-ink-muted">
                        {c.openConflicts} to confirm
                      </span>
                    </span>
                    <Link to={`/clients/${c.slug}`} className="btn-secondary btn-sm">
                      Review
                      <Icon name="arrow-right" className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="clients-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div>
                <h2 id="clients-heading" className="section-title">Clients</h2>
                <p className="mt-0.5 text-[0.8125rem] text-ink-muted">
                  Each client has their own memory. Nothing crosses between them.
                </p>
              </div>
              <p className="text-xs tabular-nums text-ink-muted">
                {list.length} client{list.length === 1 ? '' : 's'}
              </p>
            </div>
            <ul className="surface divide-y divide-line overflow-hidden">
              {list.map((client) => (
                <ClientRow key={client.id} client={client} />
              ))}
            </ul>
          </section>
        </>
      )}

      <AddClientDialog
        open={dialogOpen}
        onClose={() => {
          create.reset();
          setDialogOpen(false);
        }}
        onSubmit={(input) => void create.run(input)}
        pending={create.pending}
        error={create.error}
      />
    </div>
  );
}

/**
 * The totals across every client, summed from the same counts each client row
 * shows. Nothing here is computed anywhere else or estimated.
 */
function Overview({ clients: list }: { clients: ClientSummary[] }) {
  const sum = (pick: (c: ClientSummary) => number) => list.reduce((n, c) => n + pick(c), 0);
  const projects = sum((c) => c.projectCount);

  const metrics: Array<{ label: string; value: number; note: string; icon: IconName; tone: string }> = [
    {
      label: 'Decisions',
      value: sum(totalMemory),
      note: `across ${list.length} client${list.length === 1 ? '' : 's'} · ${projects} project${projects === 1 ? '' : 's'}`,
      icon: 'layers',
      tone: 'text-memory',
    },
    { label: 'Preferences', value: sum((c) => c.counts.preference), note: 'what clients want', icon: 'bookmark', tone: 'text-ink-muted' },
    { label: 'Rejections', value: sum((c) => c.counts.rejection), note: 'what not to repeat', icon: 'x', tone: 'text-reject' },
    { label: 'Approvals', value: sum((c) => c.counts.approval), note: 'what has already landed', icon: 'check', tone: 'text-memory' },
  ];

  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="sr-only">Overview</h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-card lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col bg-paper px-4 py-4 sm:px-5">
            <dt className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-soft">
              <Icon name={m.icon} className={`h-3.5 w-3.5 ${m.tone}`} strokeWidth={2} />
              {m.label}
            </dt>
            <dd className="mt-2 font-display text-[1.75rem] font-medium leading-none tabular-nums text-ink">
              {m.value}
            </dd>
            <dd className="mt-1.5 text-xs text-ink-muted">{m.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** First-run state. Explains the product rather than showing empty counters. */
function Onboarding({ onCreate }: { onCreate: () => void }) {
  const steps: Array<{ t: string; d: string; icon: IconName }> = [
    { t: 'Create a client', d: 'ClientOS starts a decision memory for them.', icon: 'workspace' },
    { t: 'Record feedback', d: 'It keeps the durable decisions and ignores the noise.', icon: 'message' },
    { t: 'Ask for direction', d: 'Every recommendation cites the decisions behind it.', icon: 'compass' },
  ];
  return (
    <section className="surface px-6 py-10 text-center sm:px-10 sm:py-12">
      <p className="eyebrow">Welcome to ClientOS</p>
      <h2 className="mx-auto mt-2 max-w-lg font-display text-[1.375rem] font-medium leading-snug text-ink">
        Remember why your clients decide.
      </h2>
      <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-ink-muted">
        Add a client, record what they tell you, and ClientOS keeps the decisions that matter —
        then uses them the next time you ask for a direction.
      </p>

      <ol className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.t} className="rounded-lg border border-line bg-paper-sunken/60 p-4">
            <span className="flex items-center gap-2 text-ink-muted">
              <Icon name={step.icon} className="h-4 w-4" />
              <span className="eyebrow">Step {i + 1}</span>
            </span>
            <p className="mt-2 text-sm font-medium text-ink">{step.t}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{step.d}</p>
          </li>
        ))}
      </ol>

      <button type="button" className="btn-primary mt-8" onClick={onCreate}>
        <Icon name="plus" className="h-4 w-4" />
        Create your first client
      </button>
    </section>
  );
}

function ClientRow({ client }: { client: ClientSummary }) {
  const memoryCount = totalMemory(client);
  const isNew = client.interactionCount === 0;

  return (
    <li>
      <Link
        to={`/clients/${client.slug}`}
        className="group grid gap-4 px-4 py-4 transition-colors hover:bg-paper-raised focus-visible:ring-inset sm:px-5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-8"
      >
        <div className="flex min-w-0 items-start gap-3">
          <ClientAvatar name={client.name} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-[0.9375rem] font-semibold text-ink">{client.name}</h3>
              {client.openConflicts > 0 && (
                <span className="badge badge-accent">{client.openConflicts} to confirm</span>
              )}
            </div>
            {client.context && (
              <p className="mt-0.5 line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-muted md:line-clamp-1">
                {client.context}
              </p>
            )}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
              <span>{client.projectCount} project{client.projectCount === 1 ? '' : 's'}</span>
              <span aria-hidden="true">·</span>
              <span>{client.interactionCount} interaction{client.interactionCount === 1 ? '' : 's'}</span>
              <span aria-hidden="true">·</span>
              <span>Last activity {formatRelative(client.lastInteractionAt)}</span>
            </p>
          </div>
        </div>

        {isNew ? (
          <p className="text-xs leading-relaxed text-ink-muted md:max-w-[16rem] md:text-right">
            No decisions recorded yet — add feedback to start this client's memory.
          </p>
        ) : (
          <dl className="grid grid-cols-4 gap-2 border-t border-line-soft pt-3 md:flex md:gap-7 md:border-0 md:pt-0">
            <Stat label="Decisions" value={memoryCount} emphasis />
            <Stat label="Preferences" value={client.counts.preference} />
            <Stat label="Rejections" value={client.counts.rejection} />
            <Stat label="Approvals" value={client.counts.approval} />
          </dl>
        )}

        <Icon
          name="chevron-right"
          className="hidden h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink-muted md:block"
        />
      </Link>
    </li>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className="min-w-0 md:min-w-[4.5rem]">
      <dt className="text-2xs font-medium text-ink-muted">{label}</dt>
      <dd
        className={`mt-1 text-lg font-semibold leading-none tabular-nums ${
          emphasis ? 'text-ink' : 'text-ink-soft'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
