import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { useToastStore } from '@/store/toast';

/** Banners slide down from the top, like iOS notifications. */
export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="cl-banner cl-bar pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[18px] px-4 py-3 text-[15px] shadow-[0_8px_30px_rgba(0,0,0,0.18)] ring-1 ring-black/5 dark:ring-white/10">
          {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />}
          <span className="flex-1">{t.message}</span>
          <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-muted active:opacity-60"><X className="size-4" /></button>
        </div>
      ))}
    </div>
  );
}
