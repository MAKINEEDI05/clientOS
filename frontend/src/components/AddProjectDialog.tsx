import { useState } from 'react';
import { Modal } from './Modal';
import { Spinner } from './States';

/** Create a project for the client currently open. */
export function AddProjectDialog({
  open, onClose, onSubmit, pending, error, clientName,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; description?: string }) => void;
  pending: boolean;
  error: unknown;
  clientName: string;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const canSubmit = name.trim().length > 0 && !pending;

  // The footer button lives outside the <form> element, so it calls this
  // directly rather than relying on the `form` attribute.
  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    });
  };

  const handleClose = () => {
    if (pending) return;
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New project"
      description={`A new stream of work for ${clientName}. It shares this client's memory, scoped to the project.`}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" onClick={submit} className="btn-primary" disabled={!canSubmit}>
            {pending && <Spinner />}
            {pending ? 'Creating…' : 'Create project'}
          </button>
        </>
      }
    >
      <form
        id="add-project-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="project-name" className="label">
            Project name <span className="text-reject">*</span>
          </label>
          <input
            id="project-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Premium Website Redesign"
            maxLength={80}
            required
            disabled={pending}
          />
        </div>

        <div>
          <label htmlFor="project-description" className="label">Description <span className="font-normal normal-case tracking-normal text-ink-muted/70">(optional)</span></label>
          <textarea
            id="project-description"
            className="input min-h-[4rem] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="Full redesign of the marketing site."
            maxLength={500}
            disabled={pending}
          />
        </div>

        {error !== null && (
          <div role="alert" className="rounded-lg border-l-2 border-l-reject bg-reject-soft/50 px-3 py-2.5 text-sm">
            <p className="font-medium text-ink">Could not create project</p>
            <p className="mt-0.5 leading-relaxed text-ink-soft">
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}
