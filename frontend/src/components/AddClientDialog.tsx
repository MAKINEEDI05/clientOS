import { useState } from 'react';
import { Modal } from './Modal';
import { Spinner } from './States';
import { ApiError } from '../lib/api';

/**
 * Create a client.
 *
 * Memory provisioning happens server-side as part of creating the client — the
 * user never sees or supplies anything about the memory layer.
 */
export function AddClientDialog({
  open, onClose, onSubmit, pending, error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; description?: string; firstProjectName?: string }) => void;
  pending: boolean;
  error: unknown;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [firstProject, setFirstProject] = useState('');

  const apiError = error instanceof ApiError ? error : null;
  const isMemoryFailure = apiError?.isMemoryFailure ?? false;
  const canSubmit = name.trim().length > 0 && !pending;

  // The footer button lives outside the <form> element, so it calls this
  // directly rather than relying on the `form` attribute.
  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(firstProject.trim() ? { firstProjectName: firstProject.trim() } : {}),
    });
  };

  const reset = () => {
    setName('');
    setDescription('');
    setFirstProject('');
  };

  const handleClose = () => {
    if (pending) return;
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New client"
      description="ClientOS will start building a decision memory for this client straight away."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" onClick={submit} className="btn-primary" disabled={!canSubmit}>
            {pending && <Spinner />}
            {pending ? 'Creating…' : 'Create client'}
          </button>
        </>
      }
    >
      <form
        id="add-client-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="client-name" className="label">
            Client name <span className="text-reject">*</span>
          </label>
          <input
            id="client-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vive Studio"
            maxLength={80}
            required
            disabled={pending}
          />
        </div>

        <div>
          <label htmlFor="client-description" className="label">Description <span className="font-normal normal-case tracking-normal text-ink-muted/70">(optional)</span></label>
          <textarea
            id="client-description"
            className="input min-h-[4rem] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="Premium design studio repositioning its brand upmarket."
            maxLength={500}
            disabled={pending}
            aria-describedby="client-description-help"
          />
          <p id="client-description-help" className="mt-1 text-xs text-ink-muted">
            Gives ClientOS background when it reasons about this client's work.
          </p>
        </div>

        <div>
          <label htmlFor="client-first-project" className="label">First project <span className="font-normal normal-case tracking-normal text-ink-muted/70">(optional)</span></label>
          <input
            id="client-first-project"
            className="input"
            value={firstProject}
            onChange={(e) => setFirstProject(e.target.value)}
            placeholder="Premium Website Redesign"
            maxLength={80}
            disabled={pending}
          />
          <p className="mt-1 text-xs text-ink-muted">
            You can add projects later from the client workspace.
          </p>
        </div>

        {error !== null && (
          <div
            role="alert"
            className={`rounded-lg border-l-2 px-3 py-2.5 text-sm ${
              isMemoryFailure
                ? 'border-l-caution bg-caution-soft/50 text-ink-soft'
                : 'border-l-reject bg-reject-soft/50 text-ink-soft'
            }`}
          >
            <p className="font-medium text-ink">
              {isMemoryFailure ? 'Client memory could not be set up' : 'Could not create client'}
            </p>
            <p className="mt-0.5 leading-relaxed">
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </p>
            {isMemoryFailure && (
              <p className="mt-1.5 leading-relaxed">
                Nothing was created. ClientOS will not set up a client it cannot store memory for.
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
