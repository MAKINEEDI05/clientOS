import { ComparePanes } from './ComparePanes';
import { Icon } from './Icon';

/**
 * How the preference change affected the direction on screen.
 *
 * BEFORE is the summary of the recommendation that was actually displayed when
 * the change was applied; AFTER is the summary of the regenerated one. Both are
 * real output — nothing here is written for a particular scenario, and no
 * regeneration happens until the user asks for it.
 */
export function RecommendationChange({
  before, after, onRegenerate, regenerating, projectName,
}: {
  before: string;
  after: string | null;
  onRegenerate: () => void;
  regenerating: boolean;
  /** Which project's direction changed — one client can have several. */
  projectName?: string | null;
}) {
  return (
    <section aria-live="polite" className="surface animate-fade-in overflow-hidden">
      <div className="border-b border-line px-5 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="eyebrow text-ink">Recommendation updated</p>
          {projectName && (
            <span className="inline-flex items-center gap-1 text-2xs text-ink-muted">
              <Icon name="folder" className="h-3 w-3" />
              {projectName}
            </span>
          )}
        </div>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">
          {after
            ? "Your client's latest decision changed the direction."
            : "Your client's latest decision affects the direction you had on screen."}
        </p>
      </div>

      <ComparePanes
        divider="arrow"
        before={{ label: 'Before', text: before }}
        after={after ? { label: 'After', icon: 'layers', text: after } : null}
      />

      {!after && (
        <div className="border-t border-line px-5 py-3.5 sm:px-6">
          <button
            type="button"
            className="btn-primary w-full sm:w-auto"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            {regenerating ? 'Generating…' : 'Generate updated direction'}
            {!regenerating && <Icon name="arrow-right" className="h-4 w-4" />}
          </button>
        </div>
      )}
    </section>
  );
}
