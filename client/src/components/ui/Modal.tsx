import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button, IconButton } from './Button';
import clsx from 'clsx';

/** Native <dialog>: focus trap, Escape to close and inert background come from the browser. Bottom sheet on phones. */
export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-label={title}
      className={clsx(
        'm-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-lg border border-line bg-surface p-0 text-fg shadow-pop backdrop:bg-black/50 sm:m-auto sm:rounded-lg',
        size === 'sm' && 'sm:max-w-sm', size === 'md' && 'sm:max-w-md', size === 'lg' && 'sm:max-w-xl',
      )}
    >
      {open && (
        <div className="anim-rise">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-3">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <IconButton label="Close" onClick={onClose}><X className="h-4 w-4" /></IconButton>
          </div>
          <div className="px-5 py-4 pb-safe">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', loading, onConfirm, onCancel }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; loading?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
