import clsx from 'clsx';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { useToastStore } from '@/store/toast';

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="cl-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-border-strong bg-bg px-4 py-3 text-sm shadow-md">
          {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
          <span className={clsx('flex-1', t.kind === 'error' && 'text-text')}>{t.message}</span>
          <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-muted hover:text-text"><X className="size-4" /></button>
        </div>
      ))}
    </div>
  );
}
