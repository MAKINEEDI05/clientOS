import { useState } from 'react';
import { Modal } from './Modal';
import { Spinner } from './States';
import { Icon } from './Icon';
import { ApiError } from '../lib/api';

/**
 * Confirm the permanent deletion of a client.
 *
 * Deliberately hard to trigger by accident: nothing happens on open, the name
 * must be typed exactly (never prefilled), and the server's admin token is
 * required — the same guard as the demo reset. The token is sent with this one
 * request and never stored. While the request runs, every control is disabled
 * and the dialog cannot be dismissed, so it cannot be sent twice.
 */
export function DeleteClientDialog({
  open, clientName, projectCount, pending, error, onCancel, onConfirm,
}: {
  open: boolean;
  clientName: string;
  /** The client's real project count, from the API. */
  projectCount: number;
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  onConfirm: (token: string) => void;
}) {
  const [typedName, setTypedName] = useState('');
  const [token, setToken] = useState('');

  const nameMatches = typedName === clientName;
  const canDelete = nameMatches && token.length > 0 && !pending;

  const close = () => {
    if (pending) return; // never abandon a deletion that is in flight
    setTypedName('');
    setToken('');
    onCancel();
  };

  const confirm = () => {
    if (canDelete) onConfirm(token);
  };

  const failure = error ? describeDeletionError(error, clientName) : null;

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Delete ${clientName}?`}
      description="This action cannot be undone."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={close} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canDelete}
            className="btn bg-reject text-white shadow-card hover:bg-reject/90"
          >
            {pending ? (
              <>
                <Spinner className="h-3.5 w-3.5" />
                Deleting client…
              </>
            ) : (
              'Delete client'
            )}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirm();
        }}
        className="space-y-4"
      >
        <div className="rounded-lg border border-reject-line bg-reject-soft/40 px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <Icon name="alert" className="h-4 w-4 text-reject" />
            This permanently deletes:
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-6 text-sm leading-relaxed text-ink-soft marker:text-ink-faint">
            <li>
              <span className="font-medium text-ink">
                {projectCount} project{projectCount === 1 ? '' : 's'}
              </span>
            </li>
            <li>all feedback and interactions</li>
            <li>decision history — every remembered decision and preference change</li>
            <li>recommendations</li>
            <li>preference conflicts</li>
            <li>client memory in Hindsight</li>
          </ul>
        </div>

        <div>
          <label htmlFor="delete-client-name" className="label">
            Type <span className="font-semibold text-ink">“{clientName}”</span> to confirm
          </label>
          <input
            id="delete-client-name"
            className="input"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            aria-describedby="delete-client-name-help"
          />
          <p id="delete-client-name-help" className="mt-1 text-xs text-ink-muted">
            The name must match exactly.
          </p>
        </div>

        <div>
          <label htmlFor="delete-client-token" className="label">Admin token</label>
          <input
            id="delete-client-token"
            type="password"
            className="input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            disabled={pending}
            aria-describedby="delete-client-token-help"
          />
          <p id="delete-client-token-help" className="mt-1 text-xs leading-relaxed text-ink-muted">
            The server’s admin token for destructive operations — the same one used for demo resets.
            It is sent with this request only and never stored.
          </p>
        </div>

        {failure && (
          <div role="alert" className="flex gap-2.5 rounded-lg border border-reject-line bg-reject-soft/60 px-3 py-2.5">
            <Icon name="alert" className="mt-0.5 h-4 w-4 text-reject" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-ink">{failure.title}</p>
              <p className="mt-0.5 leading-relaxed text-ink-soft">{failure.detail}</p>
              {error instanceof ApiError && error.requestId && (
                <p className="mt-1 font-mono text-2xs text-ink-muted">ref {error.requestId}</p>
              )}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

/**
 * What a failed deletion means, in words that are only as certain as the server
 * is. "Nothing was deleted" is said only where the backend guarantees it.
 */
export function describeDeletionError(error: unknown, clientName: string): { title: string; detail: string } {
  if (!(error instanceof ApiError)) {
    return {
      title: 'Client could not be deleted',
      detail: 'Something unexpected went wrong, so the deletion could not be confirmed. Check the client list before trying again.',
    };
  }
  switch (error.code) {
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      // Rejected before the request reaches the deletion logic.
      return { title: 'Admin token not accepted', detail: 'Nothing was deleted. Check the token and try again.' };
    case 'NOT_FOUND':
      // Two different 404s share this code: the deletion service's "Client not
      // found", and the server's fallback for a route it does not have — e.g. a
      // backend still running a build from before client deletion existed.
      if (error.message === 'Client not found') {
        return { title: 'Client not found', detail: `${clientName} no longer exists — it may already have been deleted.` };
      }
      return {
        title: 'Deleting clients is not available on this server',
        detail: 'The server does not recognise this request — it may be running an older build. Restart the backend and try again. Nothing was deleted.',
      };
    case 'VALIDATION_ERROR':
      return { title: 'Client could not be deleted', detail: `${error.message} Nothing was deleted.` };
    case 'CONFLICT':
      // The server's own message states that nothing was removed.
      return { title: 'Client could not be deleted safely', detail: error.message };
    case 'MEMORY_UNAVAILABLE':
      // The database transaction is rolled back when the bank deletion fails.
      return {
        title: 'Client memory could not be deleted',
        detail: `Hindsight did not confirm the deletion of ${clientName}’s memory, so the client and all of its data were kept. You can try again.`,
      };
    case 'NETWORK':
      return {
        title: 'Cannot reach ClientOS',
        detail: 'The request did not complete, so the deletion could not be confirmed. Check the client list before trying again.',
      };
    default:
      // Includes the one partial case — memory deleted, record kept — which the
      // server describes precisely, with what to do next.
      return { title: 'Client could not be deleted', detail: error.message };
  }
}
