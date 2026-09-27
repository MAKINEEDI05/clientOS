import { useState } from 'react';
import { Spinner } from './States';
import type { InteractionSource, SubmitInteractionResult } from '../types/api';

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
  onSubmit, pending, error, lastResult,
}: {
  onSubmit: (input: { label: string; source: InteractionSource; content: string }) => void;
  pending: boolean;
  error: string | null;
  lastResult: SubmitInteractionResult | null;
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
    <form onSubmit={handleSubmit} className="card p-4">
      <h3 className="eyebrow mb-3">Record client feedback</h3>

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
            className="input"
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

      <div className="mt-3">
        <label htmlFor="interaction-content" className="label">What the client said</label>
        <textarea
          id="interaction-content"
          className="input min-h-[5rem] resize-y"
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
          placeholder="We're now open to brighter accent colours."
          maxLength={MAX_CONTENT}
          required
          disabled={pending}
          aria-describedby="interaction-help"
        />
        <p id="interaction-help" className="mt-1 flex justify-between text-xs text-ink-muted">
          <span>ClientOS extracts only durable decisions — vague feedback is not stored.</span>
          <span className="tabular-nums">{content.length}/{MAX_CONTENT}</span>
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-reject-soft px-3 py-2 text-sm text-reject">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary mt-3" disabled={!canSubmit}>
        {pending && <Spinner />}
        {pending ? 'Analysing feedback…' : 'Record feedback'}
      </button>

      {lastResult && <ExtractionReport result={lastResult} />}
    </form>
  );
}

/**
 * Shows what was retained AND what was discarded.
 *
 * Surfacing the discards is the point: it demonstrates selectivity rather than
 * claiming it.
 */
function ExtractionReport({ result }: { result: SubmitInteractionResult }) {
  return (
    <div className="mt-4 border-t border-black/[0.06] pt-3.5">
      <p className="eyebrow mb-2">What ClientOS took from “{result.interaction.label}”</p>

      {result.extracted.length === 0 && result.discarded.length === 0 && (
        <p className="text-xs text-ink-muted">Nothing durable was found.</p>
      )}

      {result.extracted.length > 0 && (
        <ul className="space-y-1.5">
          {result.extracted.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
              <span
                aria-hidden="true"
                className={c.retained ? 'text-approve' : 'text-caution'}
              >
                {c.retained ? '✓' : '⋯'}
              </span>
              <span className="text-ink-soft">
                {c.statement}
                {!c.retained && (
                  <span className="text-caution">
                    {' '}— held for your confirmation
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result.discarded.length > 0 && (
        <details className="mt-2.5">
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink-soft">
            Not stored ({result.discarded.length})
          </summary>
          <ul className="mt-1.5 space-y-1">
            {result.discarded.map((d, i) => (
              <li key={i} className="text-xs leading-relaxed text-ink-muted">
                <span className="text-ink-soft">{d.text || '(fragment)'}</span> — {d.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.warnings.map((w, i) => (
        <p key={i} className="mt-2 text-xs text-caution">{w}</p>
      ))}
    </div>
  );
}
