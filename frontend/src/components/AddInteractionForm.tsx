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
      <div className="border-b border-line px-4 py-3.5 sm:px-5">
        <h2 id="add-feedback-heading" className="section-title flex items-center gap-2">
          <Icon name="message" className="h-4 w-4 text-ink-muted" />
          Add client feedback
        </h2>
        {projectName && (
          <p className="mt-1 text-[0.8125rem] text-ink-muted">
            Adding feedback to{' '}
            <span className="font-medium text-ink">{projectName}</span>
          </p>
        )}
      </div>

      <div className="space-y-3.5 px-4 py-4 sm:px-5">
        <p className="text-xs leading-relaxed text-ink-muted">
          Write what the client actually said. ClientOS works out what is worth remembering —
          you do not categorise it.
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="interaction-label" className="label">Label</label>
            <input
              id="interaction-label"
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Revision #6"
              maxLength={80}
              required
              disabled={pending}
            />
          </div>
          <div>
            <label htmlFor="interaction-source" className="label">Source</label>
            <select
              id="interaction-source"
              className="select sm:min-w-[9rem]"
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
          <label htmlFor="interaction-content" className="label">What the client said</label>
          <textarea
            id="interaction-content"
            className="input min-h-[6rem] resize-y leading-relaxed"
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
            placeholder="We're now open to brighter accent colours."
            maxLength={MAX_CONTENT}
            required
            disabled={pending}
            aria-describedby="interaction-help"
          />
          <p id="interaction-help" className="mt-1.5 flex justify-between gap-3 text-xs text-ink-muted">
            <span>ClientOS extracts only durable decisions — vague feedback is not stored.</span>
            <span className="shrink-0 tabular-nums">{content.length}/{MAX_CONTENT}</span>
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-reject-line bg-reject-soft px-3 py-2 text-sm text-reject">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end border-t border-line bg-paper-sunken/50 px-4 py-3 sm:px-5">
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={!canSubmit}>
          {pending && <Spinner />}
          {pending ? 'Analysing feedback…' : 'Add feedback'}
        </button>
      </div>
    </form>
  );
}
