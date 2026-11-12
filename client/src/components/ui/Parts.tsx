import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatINR } from '@/utils/money';
import type { PageMeta } from '@/types/api';
import { Button } from './Button';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Money({ paise, className, decimals = true }: { paise: number; className?: string; decimals?: boolean }) {
  return <span className={clsx('tabular-nums', className)}>{formatINR(paise, { decimals })}</span>;
}

/** Plain bordered section; the only container style in the app. */
export function Panel({ title, action, children, className, flush }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={clsx('rounded-md border bg-bg', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ percent, level = 'ok', label }: { percent: number; level?: 'ok' | 'warning' | 'over'; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percent)} className="h-1.5 w-full overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-border">
      <div className={clsx('h-full rounded-full transition-[width]', level === 'over' ? 'bg-danger' : level === 'warning' ? 'bg-text' : 'bg-accent')} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = { paid: 'Paid', partially_paid: 'Partially paid', pending: 'Pending', overdue: 'Overdue', settled: 'Settled', partially_settled: 'Partially settled' };
export function StatusBadge({ status }: { status: string }) {
  const bad = status === 'overdue';
  const done = status === 'paid' || status === 'settled';
  return (
    <span className={clsx('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', bad ? 'border-danger/50 text-danger' : done ? 'border-accent/40 bg-accent/10 text-accent' : 'text-muted')}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Pagination({ meta, onPage }: { meta: PageMeta | undefined; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted">Page {meta.page} of {meta.totalPages} · {meta.total} items</span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><ChevronLeft className="size-4" aria-hidden />Previous</Button>
        <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next<ChevronRight className="size-4" aria-hidden /></Button>
      </div>
    </nav>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-md border p-0.5">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={clsx('h-8 rounded-[5px] px-3 text-[13px] font-medium transition-colors', value === o.value ? 'bg-primary text-primary-fg' : 'text-muted hover:text-text')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
