import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onClose }: {
  open: boolean; title: string; message: string; confirmLabel: string; onConfirm: () => Promise<unknown> | unknown; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title}>
      <p className="px-1 text-[15px] text-muted">{message}</p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2 sm:[&>*:first-child]:order-2">
        <Button variant="danger" loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } catch { /* the caller's mutation shows the error banner */ } finally { setBusy(false); } }}>{confirmLabel}</Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      </div>
    </Modal>
  );
}
