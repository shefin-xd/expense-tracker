import type { ReactNode } from 'react';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary dark:border dark:border-strong">
            <svg viewBox="0 0 32 32" className="h-4.5 w-4.5" aria-hidden><path d="M9 9h14M9 16h14M9 23h8" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" /></svg>
          </div>
          <span className="text-base font-semibold tracking-tight">CampusLedger</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        <div className="mt-7">{children}</div>
        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}
