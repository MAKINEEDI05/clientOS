/**
 * How the preference change affected the direction on screen.
 *
 * BEFORE is the summary of the recommendation that was actually displayed when
 * the change was applied; AFTER is the summary of the regenerated one. Both are
 * real output — nothing here is written for a particular scenario, and no
 * regeneration happens until the user asks for it.
 */
export function RecommendationChange({
  before, after, onRegenerate, regenerating,
}: {
  before: string;
  after: string | null;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  return (
    <section aria-live="polite" className="rounded-2xl border border-black/[0.08] bg-paper px-5 py-4 shadow-card sm:px-6">
      <p className="eyebrow">Recommendation updated</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        {after
          ? "Your client's latest decision changed the direction."
          : "Your client's latest decision affects the direction you had on screen."}
      </p>

      <dl className="mt-4 space-y-3">
        <div>
          <dt className="eyebrow">Before</dt>
          <dd className="mt-1 text-sm leading-relaxed text-ink-muted">{before}</dd>
        </div>
        {after && (
          <div>
            <dt className="eyebrow text-approve">After</dt>
            <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink">{after}</dd>
          </div>
        )}
      </dl>

      {!after && (
        <button
          type="button"
          className="btn-primary mt-4 w-full sm:w-auto"
          onClick={onRegenerate}
          disabled={regenerating}
        >
          {regenerating ? 'Generating…' : 'Generate updated direction →'}
        </button>
      )}
    </section>
  );
}
