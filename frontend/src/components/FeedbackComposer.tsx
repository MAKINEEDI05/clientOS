import { useState } from 'react';
import { Spinner } from './States';
import { Icon } from './Icon';

/**
 * Captures the outcome of a recommendation, closing the learning loop.
 *
 * Renders without its own frame: it sits in the footer of the recommendation it
 * is about, so the question is visibly asked of that answer.
 */
export function FeedbackComposer({
  onSubmit, pending, done, error,
}: {
  onSubmit: (verdict: 'accepted' | 'rejected' | 'corrected', comment?: string) => void;
  pending: boolean;
  done: boolean;
  error: string | null;
}) {
  const [correcting, setCorrecting] = useState(false);
  const [comment, setComment] = useState('');

  if (done) {
    return (
      <p className="flex items-center gap-2 text-sm text-memory">
        <Icon name="check" className="h-4 w-4" strokeWidth={2.25} />
        Outcome recorded. ClientOS will use it in future recommendations for this client.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Was this useful?</h3>
          <p className="mt-0.5 max-w-md text-xs leading-relaxed text-ink-muted">
            Recording the outcome adds it to the client's memory, so the next recommendation accounts for it.
          </p>
        </div>

        {!correcting && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => onSubmit('accepted')}>
              {pending ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="check" className="h-3.5 w-3.5" />}
              Accept
            </button>
            <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => onSubmit('rejected')}>
              <Icon name="x" className="h-3.5 w-3.5" />
              Reject
            </button>
            <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => setCorrecting(true)}>
              Correct it…
            </button>
          </div>
        )}
      </div>

      {correcting && (
        <form
          className="mt-3.5 animate-fade-in"
          onSubmit={(e) => {
            e.preventDefault();
            if (comment.trim()) onSubmit('corrected', comment.trim());
          }}
        >
          <label htmlFor="correction" className="label">What should it have said?</label>
          <textarea
            id="correction"
            className="input min-h-[4.5rem] resize-y"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            maxLength={1000}
            required
            disabled={pending}
          />
          <div className="mt-2.5 flex gap-2">
            <button type="submit" className="btn-primary btn-sm" disabled={pending || !comment.trim()}>
              {pending && <Spinner className="h-3.5 w-3.5" />}Save correction
            </button>
            <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => setCorrecting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="mt-2.5 text-sm text-reject">{error}</p>}
    </div>
  );
}
