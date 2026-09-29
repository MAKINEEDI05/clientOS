import { useState } from 'react';
import { Spinner } from './States';
import { Icon } from './Icon';
import type { InteractionSource } from '../types/api';

const SOURCES: Array<{ value: InteractionSource; label: string }> = [
  { value: 'revision', label: 'Revision' },
  { value: 'design-review', label: 'Design review' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'note', label: 'Note' },
];

const MAX_CONTENT = 5000;

/**
 * Records new client feedback.
 *
 * The submit button is disabled while a request is in flight, which — together
 * with the backend's unique (project, label) constraint — is what stops a
 * double-click creating duplicate memory.
 */
export function AddInteractionForm({
  onSubmit, pending, error, projectName,
}: {
  onSubmit: (input: { label: string; source: InteractionSource; content: string }) => void;
  pending: boolean;
  error: string | null;
  /**
   * The project this feedback will be recorded against — the shared active
   * project, shown rather than chosen. Feedback becomes memory, so the
   * destination must never be a guess on the user's part.
   */
  projectName?: string | null;
}) {
  const [label, setLabel] = useState('');
  const [source, setSource] = useState<InteractionSource>('revision');
  const [content, setContent] = useState('');

  const canSubmit = label.trim().length > 0 && content.trim().length > 0 && !pending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ label: label.trim(), source, content: content.trim() });
    setLabel('');
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit} className="surface" aria-labelledby="add-feedback-heading">
      <div className="px-4 pt-4">
        <h2 id="add-feedback-heading" className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-ink">
          <Icon name="message" className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2} />
          Add feedback
        </h2>
        <p className="mt-1.5 text-sm text-ink-soft">Tell ClientOS what the client said.</p>
        {projectName && (
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            Adding feedback to{' '}
            <span className="font-medium text-ink-soft">{projectName}</span>
          </p>
        )}
      </div>

      <div className="space-y-3 px-4 pb-3.5 pt-3">
        <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2.5">
          <div>
            <label htmlFor="interaction-label" className="label text-xs">Label</label>
            <input
              id="interaction-label"
              className="input py-1.5"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Revision #6"
              maxLength={80}
              required
              disabled={pending}
            />
          </div>
          <div>
            <label htmlFor="interaction-source" className="label text-xs">Source</label>
            <select
              id="interaction-source"
              className="select py-1.5"
              value={source}
              onChange={(e) => setSource(e.target.value as InteractionSource)}
              disabled={pending}
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="interaction-content" className="label text-xs">What the client said</label>
          <textarea
            id="interaction-content"
            className="input min-h-[4.75rem] resize-y leading-relaxed"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
            placeholder="We're now open to brighter accent colours."
            maxLength={MAX_CONTENT}
            required
            disabled={pending}
            aria-describedby="interaction-help"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-reject-line bg-reject-soft px-3 py-2 text-sm text-reject">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-paper-sunken/50 px-4 py-2.5">
        <p id="interaction-help" className="min-w-0 text-2xs leading-snug text-ink-muted">
          Only durable decisions are kept — vague feedback is not stored.
          <span className="sr-only"> {content.length} of {MAX_CONTENT} characters.</span>
        </p>
        <button type="submit" className="btn-primary btn-sm shrink-0" disabled={!canSubmit}>
          {pending && <Spinner className="h-3.5 w-3.5" />}
          {pending ? 'Analysing feedback…' : 'Add feedback'}
        </button>
      </div>
    </form>
  );
}
