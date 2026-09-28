import type { EvidenceItem } from '../types/api';
import { scopeLabel } from '../lib/scope';
import { typeLabel } from './Badges';

/**
 * Where a recalled memory actually came from.
 *
 * Collapsed by default: a user reading a recommendation does not need the memory
 * id, and the product is not a debugging console. Expanded, it shows that the
 * citation is a real stored memory with real scope tags — which is what makes the
 * claim "this came from the client's memory" verifiable rather than asserted.
 *
 * Every value here is rendered from what the recall returned. Nothing is derived,
 * reformatted into something it is not, or filled in when absent.
 */
export function MemoryProvenance({ evidence }: { evidence: EvidenceItem }) {
  const tags = evidence.tags ?? [];

  return (
    <details className="group mt-2.5">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[0.6875rem] font-medium text-ink-muted transition-colors hover:text-ink-soft">
        <span
          aria-hidden="true"
          className="inline-block transition-transform group-open:rotate-90"
        >
          ›
        </span>
        Memory provenance
      </summary>

      <dl className="mt-2 space-y-1 border-l-2 border-black/[0.07] pl-2.5 text-[0.6875rem] leading-relaxed">
        <Row label="Stored in">Hindsight memory</Row>
        <Row label="Memory ID">
          {/* Real Hindsight id. Deliberately small and monospaced: provenance,
              not content. Breaks anywhere so it cannot force a scroll at 390px. */}
          <span className="break-all font-mono text-ink-soft">{evidence.memoryId}</span>
        </Row>
        <Row label="Scope">{scopeLabel(evidence.scope)}</Row>
        <Row label="Type">{typeLabel(evidence.memoryType)}</Row>
        {evidence.sourceLabelDisplay && <Row label="Source">{evidence.sourceLabelDisplay}</Row>}
        {tags.length > 0 && (
          <div className="grid gap-0.5 pt-0.5 sm:grid-cols-[5.5rem_1fr] sm:gap-2">
            <dt className="text-ink-muted">Tags</dt>
            <dd className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="break-all rounded bg-paper-sunken px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-muted"
                >
                  {t}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </details>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[5.5rem_1fr] sm:gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-ink-soft">{children}</dd>
    </div>
  );
}
