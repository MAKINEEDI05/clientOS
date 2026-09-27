import { useState } from 'react';
import { Spinner } from './States';

/** Captures the outcome of a recommendation, closing the learning loop. */
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
      <p className="rounded-lg bg-approve-soft/50 px-3.5 py-2.5 text-sm text-approve">
        Outcome recorded. ClientOS will use it in future recommendations for this client.
      </p>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="eyebrow mb-2.5">Was this useful?</h3>
      <p className="mb-3 text-xs leading-relaxed text-ink-muted">
        Recording the outcome adds it to the client's memory, so the next recommendation accounts for it.
      </p>

      {!correcting ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => onSubmit('accepted')}>
            {pending && <Spinner />}Accept
          </button>
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => onSubmit('rejected')}>
            Reject
          </button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => setCorrecting(true)}>
            Correct it…
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (comment.trim()) onSubmit('corrected', comment.trim());
          }}
        >
          <label htmlFor="correction" className="label">What should it have said?</label>
          <textarea
            id="correction"
            className="input min-h-[4rem] resize-y"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            maxLength={1000}
            required
            disabled={pending}
          />
          <div className="mt-2.5 flex gap-2">
            <button type="submit" className="btn-primary" disabled={pending || !comment.trim()}>
              {pending && <Spinner />}Save correction
            </button>
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => setCorrecting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="mt-2.5 text-sm text-reject">{error}</p>}
    </div>
  );
}
