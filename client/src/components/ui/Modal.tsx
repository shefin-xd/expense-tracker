import clsx from 'clsx';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** iOS sheet: slides up from the bottom on phones (with a grabber), a centered card on larger screens. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector<HTMLElement>('input,select,textarea') ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const a = items[0]!, z = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; previous?.focus?.(); };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cl-fade absolute inset-0 bg-black/40" aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={clsx('cl-sheet sm:cl-dialog relative flex max-h-[92dvh] w-full flex-col rounded-t-[20px] bg-bg shadow-sheet sm:max-h-[88dvh] sm:rounded-[20px]', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-fill-strong sm:hidden" />
        <div className="relative flex shrink-0 items-center justify-center px-14 pb-3 pt-3 sm:pt-4">
          <h2 id={titleId} className="truncate text-[17px] font-semibold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="absolute right-4 top-3 grid size-8 place-items-center rounded-full bg-fill-strong text-muted active:opacity-70 sm:top-3.5"><X className="size-4" strokeWidth={2.5} /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1 sm:px-6 sm:pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
