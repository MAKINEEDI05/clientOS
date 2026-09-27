import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { clients } from '../services/clientos';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { formatRelative } from '../lib/format';
import type { ClientSummary } from '../types/api';

export function Dashboard() {
  const { data, loading, error, reload } = useAsync((signal) => clients.list(signal), []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl tracking-tight text-ink">Clients</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Every client carries its own decision memory. Open a client to ask ClientOS for direction
          grounded in what they have already approved and rejected.
        </p>
      </header>

      {loading && <LoadingState label="Loading clients" />}
      {error !== null && <ErrorState error={error} onRetry={reload} />}

      {data && data.clients.length === 0 && (
        <EmptyState
          title="No clients yet"
          description="Load the demo dataset to see ClientOS working end to end, or record your first client interaction."
          action={
            <code className="rounded bg-paper-sunken px-2.5 py-1.5 font-mono text-xs text-ink-soft">
              npm run db:seed
            </code>
          }
        />
      )}

      {data && data.clients.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ClientCard({ client }: { client: ClientSummary }) {
  const decisions =
    client.counts.preference + client.counts.approval + client.counts.rejection +
    client.counts.constraint + client.counts.decision + client.counts.preference_change;

  return (
    <li className="card transition-shadow hover:shadow-raised">
      <Link to={`/clients/${client.slug}`} className="block rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-base text-ink">{client.name}</h2>
            {client.industry && <p className="mt-0.5 text-xs text-ink-muted">{client.industry}</p>}
          </div>
          {client.openConflicts > 0 && (
            <span className="shrink-0 rounded-full bg-caution-soft px-2 py-0.5 text-[0.6875rem] font-medium text-caution">
              {client.openConflicts} to confirm
            </span>
          )}
        </div>

        <dl className="mt-3.5 grid grid-cols-3 gap-2 border-t border-black/[0.06] pt-3">
          <Stat label="Decisions" value={decisions} />
          <Stat label="Rejections" value={client.counts.rejection} />
          <Stat label="Projects" value={client.projectCount} />
        </dl>

        <p className="mt-3 text-xs text-ink-muted">
          {client.interactionCount} interaction{client.interactionCount === 1 ? '' : 's'}
          {' · last '}{formatRelative(client.lastInteractionAt)}
        </p>
      </Link>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-lg tabular-nums text-ink">{value}</dd>
    </div>
  );
}
