import { EvidenceCard } from './EvidenceCard';
import { Icon } from './Icon';
import type { EvidenceItem, Recommendation } from '../types/api';

/**
 * Every client memory that informed this recommendation.
 *
 * Built by de-duplicating the evidence the backend bound to each recommendation
 * line — so the list is exactly the set of recalled memories that survived
 * validation. It is never padded out, and the count is never estimated.
 */
export function collectEvidence(recommendation: Recommendation): EvidenceItem[] {
  const seen = new Map<string, EvidenceItem>();
  for (const line of [...recommendation.items, ...recommendation.avoid]) {
    for (const e of line.evidence) {
      if (!seen.has(e.memoryId)) seen.set(e.memoryId, e);
    }
  }
  return [...seen.values()];
}

export function ClientEvidence({
  recommendation, clientName,
}: {
  recommendation: Recommendation;
  /** Named so the evidence reads as this client's history, not generic context. */
  clientName?: string;
}) {
  const evidence = collectEvidence(recommendation);
  const count = evidence.length;

  return (
    <section aria-labelledby="client-evidence-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="client-evidence-heading" className="eyebrow">Client evidence</h2>
        <p className={`text-xs tabular-nums ${count > 0 ? 'font-medium text-memory' : 'text-ink-muted'}`}>
          {count} client memor{count === 1 ? 'y' : 'ies'} informed this recommendation
        </p>
      </div>

      {/* The bottom of the chain: these are the memories the points above are
          bound to, which is why the direction says what it says. */}
      {count > 0 && (
        <p className="mt-1.5 max-w-prose text-[0.8125rem] leading-relaxed text-ink-muted">
          The recalled decisions the points above are bound to — this is where the direction came
          from{clientName ? `, not from anything ClientOS assumed about ${clientName}` : ''}. Open a
          memory's provenance to check it against the memory service.
        </p>
      )}

      {count === 0 ? (
        <div className="mt-3 flex flex-col items-center rounded-lg border border-dashed border-line-strong px-4 py-6 text-center">
          <Icon name="layers" className="mb-2 h-5 w-5 text-ink-faint" />
          <p className="text-sm text-ink-soft">
            {recommendation.memoryUsed
              ? 'No specific client memory backed this direction.'
              : 'Client memory was switched off for this request.'}
          </p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">
            {recommendation.memoryUsed
              ? 'The direction reflects general design practice rather than this client’s history.'
              : 'Turn client memory on and ask again to ground the direction in previous decisions.'}
          </p>
        </div>
      ) : (
        <ul className="mt-3.5 grid items-start gap-2.5 sm:grid-cols-2">
          {evidence.map((e) => (
            <EvidenceCard key={e.memoryId} evidence={e} />
          ))}
        </ul>
      )}
    </section>
  );
}
