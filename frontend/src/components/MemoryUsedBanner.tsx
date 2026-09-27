import type { Recommendation } from '../types/api';

/**
 * States plainly whether client history was used, and how much.
 *
 * This is the honesty surface of the product: it reads from the response's own
 * memoryUsed/memoryCount flags rather than being asserted by the presenter.
 */
export function MemoryUsedBanner({ recommendation }: { recommendation: Recommendation }) {
  const { memoryUsed, memoryCount } = recommendation;

  if (!memoryUsed) {
    return (
      <div className="rounded-lg border border-caution/25 bg-caution-soft/50 px-3.5 py-2.5">
        <p className="text-sm font-medium text-caution">No client history was used</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          No relevant memory was found for this request, so this direction is generic.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-approve/20 bg-approve-soft/50 px-3.5 py-2.5">
      <p className="text-sm font-medium text-approve">
        Grounded in {memoryCount} recalled memor{memoryCount === 1 ? 'y' : 'ies'}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
        Recalled from this client's Hindsight memory bank. Open “Why?” on any point to see its source.
      </p>
    </div>
  );
}
