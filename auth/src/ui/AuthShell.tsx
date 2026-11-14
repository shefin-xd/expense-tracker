import type { ReactNode } from 'react';

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-[10px] bg-navy text-white" aria-hidden><svg viewBox="0 0 32 32" className="size-[18px]"><path d="M10 9v14h12" stroke="currentColor" strokeWidth="3.5" fill="none" /></svg></span>
      <span className="text-[19px] font-semibold tracking-tight">CampusLedger</span>
    </span>
  );
}

/** Centered iOS-style sign-in layout: roomy on desktop, full-width with safe-area padding on phones. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mb-8"><Logo /></div>
      <h1 className="text-[32px] font-bold leading-[1.1] tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-[16px] text-muted">{subtitle}</p>}
      <div className="mt-7 rounded-[20px] bg-surface p-5 shadow-card sm:p-6">{children}</div>
      {footer && <p className="mt-6 text-center text-[15px] text-muted">{footer}</p>}
    </main>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const style = kind === 'error' ? 'bg-danger/12 text-danger' : kind === 'success' ? 'bg-success/15 text-success' : 'bg-accent/12 text-accent';
  return <p role={kind === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-xl px-3.5 py-2.5 text-[14px] font-medium ${style}`}>{children}</p>;
}
