import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAsync, useMutation } from '../hooks/useAsync';
import { clients } from '../services/clientos';
import { AddClientDialog } from '../components/AddClientDialog';
import { ErrorState, LoadingState } from '../components/States';
import { formatRelative } from '../lib/format';
import type { ClientSummary } from '../types/api';

export function Dashboard() {
  const navigate = useNavigate();
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

  const hasClients = (data?.clients.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl tracking-tight text-ink">Clients</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Every client carries its own decision memory. Open a client to ask ClientOS for
            direction grounded in what they have already approved and rejected.
          </p>
        </div>
        {hasClients && (
          <button type="button" className="btn-primary shrink-0" onClick={() => setDialogOpen(true)}>
            + Add client
          </button>
        )}
      </header>

      {loading && <LoadingState label="Loading clients" />}
      {error !== null && <ErrorState error={error} onRetry={reload} />}

      {data && !hasClients && <Onboarding onCreate={() => setDialogOpen(true)} />}

      {data && hasClients && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </ul>
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

/** First-run state. Explains the product rather than showing empty counters. */
function Onboarding({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="card px-6 py-12 text-center sm:px-10">
      <p className="eyebrow">Welcome to ClientOS</p>
      <h2 className="mx-auto mt-2 max-w-lg font-display text-2xl leading-snug tracking-tight text-ink">
        Remember why your clients decide.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
        Add a client, record what they tell you, and ClientOS keeps the decisions that matter —
        then uses them the next time you ask for a direction.
      </p>

      <ol className="mx-auto mt-7 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        {[
          { n: '1', t: 'Create a client', d: 'ClientOS starts a decision memory for them.' },
          { n: '2', t: 'Record feedback', d: 'It keeps the durable decisions and ignores the noise.' },
          { n: '3', t: 'Ask for direction', d: 'Every recommendation cites the decisions behind it.' },
        ].map((step) => (
          <li key={step.n} className="rounded-lg border border-black/[0.07] bg-paper-sunken p-3.5">
            <span className="eyebrow">Step {step.n}</span>
            <p className="mt-1 text-sm font-medium text-ink">{step.t}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{step.d}</p>
          </li>
        ))}
      </ol>

      <button type="button" className="btn-primary mt-7" onClick={onCreate}>
        + Create your first client
      </button>
    </section>
  );
}

function ClientCard({ client }: { client: ClientSummary }) {
  const decisions =
    client.counts.preference + client.counts.approval + client.counts.rejection +
    client.counts.constraint + client.counts.decision + client.counts.preference_change;

  const memoryCount = decisions + client.counts.outcome;
  const isNew = client.interactionCount === 0;

  return (
    <li className="card transition-shadow hover:shadow-raised">
      <Link to={`/clients/${client.slug}`} className="block rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-base text-ink">{client.name}</h2>
            {client.context && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                {client.context}
              </p>
            )}
          </div>
          {client.openConflicts > 0 && (
            <span className="shrink-0 rounded-full bg-caution-soft px-2 py-0.5 text-[0.6875rem] font-medium text-caution">
              {client.openConflicts} to confirm
            </span>
          )}
        </div>

        {isNew ? (
          <p className="mt-3.5 rounded-lg border border-dashed border-black/10 px-3 py-3 text-center text-xs leading-relaxed text-ink-muted">
            No decisions recorded yet — add feedback to start this client's memory.
          </p>
        ) : (
          <>
            <dl className="mt-3.5 grid grid-cols-4 gap-2 border-t border-black/[0.06] pt-3">
              <Stat label="Memories" value={memoryCount} emphasis />
              <Stat label="Preferences" value={client.counts.preference} />
              <Stat label="Rejections" value={client.counts.rejection} />
              <Stat label="Approvals" value={client.counts.approval} />
            </dl>
            <p className="mt-3 text-xs text-ink-muted">
              {client.projectCount} project{client.projectCount === 1 ? '' : 's'} ·{' '}
              {client.interactionCount} interaction{client.interactionCount === 1 ? '' : 's'} · last{' '}
              {formatRelative(client.lastInteractionAt)}
            </p>
          </>
        )}
      </Link>
    </li>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd
        className={`mt-0.5 font-display tabular-nums ${
          emphasis ? 'text-lg text-ink' : 'text-lg text-ink-soft'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
