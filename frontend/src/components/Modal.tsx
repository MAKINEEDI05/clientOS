import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Accessible dialog shell.
 *
 * Closes on Escape, traps focus, restores focus on close, and is sized to fit a
 * phone screen (full-width with safe margins, scrollable body).
 */
export function Modal({
  open, onClose, title, description, children, footer, labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Callers commonly pass an inline arrow, so `onClose` changes identity on every
  // render. Holding it in a ref keeps the effect below keyed on `open` alone —
  // otherwise it re-ran on each keystroke and stole focus back to the first field.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first field rather than the close button — but never steal focus
    // the user has already moved into the dialog themselves.
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      if (panel.contains(document.activeElement)) return;
      panel.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    }, 30);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      previouslyFocused.current?.focus?.();
    };
    // Intentionally keyed on `open` only — see the onCloseRef note above.
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        aria-describedby={description ? descId : undefined}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-black/[0.07] bg-paper shadow-raised sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/[0.06] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg leading-snug text-ink">{title}</h2>
            {description && (
              <p id={descId} className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn-ghost -mr-2 -mt-1 shrink-0 px-2 py-1 text-lg leading-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>

        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-black/[0.06] px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Confirmation dialog for a reversible but consequential action. */
export function ConfirmDialog({
  open, onCancel, onConfirm, title, body, confirmLabel, pending, tone = 'caution',
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  tone?: 'caution' | 'danger';
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`btn text-white ${
              tone === 'danger' ? 'bg-reject hover:bg-reject/90' : 'bg-caution hover:bg-caution/90'
            }`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-soft">{body}</div>
    </Modal>
  );
}
