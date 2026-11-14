import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatINR } from '@/utils/money';
import type { PageMeta } from '@/types/api';
import { Button } from './Button';

/** Large title, as in iOS navigation bars. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-[30px] font-bold leading-[1.1] tracking-tight sm:text-[34px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Money({ paise, className, decimals = true }: { paise: number; className?: string; decimals?: boolean }) {
  return <span className={clsx('tabular-nums', className)}>{formatINR(paise, { decimals })}</span>;
}

/** An inset grouped section: small gray heading above a white rounded card. */
export function Panel({ title, action, children, className, flush }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={className}>
      {(title || action) && (
        <header className="mb-1.5 flex min-h-10 items-end justify-between gap-3 px-4 pb-0.5">
          {title && <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted">{title}</h2>}
          {action}
        </header>
      )}
      <div className={clsx('overflow-hidden rounded-2xl bg-surface shadow-card', !flush && 'p-4')}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[19px] font-semibold tabular-nums tracking-tight">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ percent, level = 'ok', label }: { percent: number; level?: 'ok' | 'warning' | 'over' | 'done'; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percent)} className="h-2 w-full overflow-hidden rounded-full bg-fill">
      <div className={clsx('h-full rounded-full transition-[width] duration-500 ease-out', level === 'over' ? 'bg-danger' : level === 'warning' ? 'bg-warning' : level === 'done' ? 'bg-success' : 'bg-accent')} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = { paid: 'Paid', partially_paid: 'Partially paid', pending: 'Pending', overdue: 'Overdue', settled: 'Settled', partially_settled: 'Partially settled', due: 'Due now', upcoming: 'Upcoming', paused: 'Paused' };
const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-success/15 text-success', settled: 'bg-success/15 text-success',
  overdue: 'bg-danger/15 text-danger', due: 'bg-warning/20 text-warning',
  partially_paid: 'bg-warning/15 text-warning', partially_settled: 'bg-warning/15 text-warning',
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={clsx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLE[status] ?? 'bg-fill text-muted')}>{STATUS_LABELS[status] ?? status}</span>;
}

export function Pagination({ meta, onPage }: { meta: PageMeta | undefined; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted">Page {meta.page} of {meta.totalPages} · {meta.total} items</span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><ChevronLeft className="size-4" aria-hidden />Previous</Button>
        <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next<ChevronRight className="size-4" aria-hidden /></Button>
      </div>
    </nav>
  );
}

/** iOS segmented control. */
export function Segmented<T extends string>({ value, onChange, options, label, full }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; full?: boolean }) {
  return (
    <div role="tablist" aria-label={label} className={clsx('inline-flex rounded-[9px] bg-fill p-0.5', full && 'flex w-full')}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={clsx('h-8 rounded-[7px] px-3.5 text-[13px] font-medium transition-all', full && 'flex-1', value === o.value ? 'bg-[var(--seg-selected)] shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]' : 'text-text/80')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
