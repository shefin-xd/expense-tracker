import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatINR } from '@/lib/money';
import type { PageMeta } from '@/lib/types';
import { Button } from './Button';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, action, children, className, flush }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={clsx('rounded-lg border border-line bg-surface', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

export const Money = ({ paise, sign, className }: { paise: number; sign?: boolean; className?: string }) => (
  <span className={clsx('num whitespace-nowrap', className)}>{formatINR(paise, { sign })}</span>
);

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted">{label}</p>
      <div className="num mt-1 truncate text-xl font-semibold tracking-tight">{value}</div>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

type Tone = 'neutral' | 'good' | 'warn' | 'danger' | 'primary';
const tones: Record<Tone, string> = {
  neutral: 'border-line text-muted', primary: 'border-accent/40 text-accent',
  good: 'border-good/40 text-good', warn: 'border-warn/40 text-warn', danger: 'border-danger/40 text-danger',
};
export const Badge = ({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) => (
  <span className={clsx('inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>
);

export function ProgressBar({ percent, level = 'ok', label }: { percent: number; level?: 'ok' | 'warning' | 'over'; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={clsx('h-full rounded-full transition-[width] duration-300', level === 'over' ? 'bg-danger' : level === 'warning' ? 'bg-warn' : 'bg-accent')} style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

export function Pagination({ meta, onPage }: { meta: PageMeta; onPage: (p: number) => void }) {
  if (meta.total === 0) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
      <span>{meta.total} {meta.total === 1 ? 'record' : 'records'}</span>
      <div className="flex items-center gap-2">
        <span className="num">Page {meta.page} of {meta.totalPages}</span>
        <Button variant="secondary" size="sm" aria-label="Previous page" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="secondary" size="sm" aria-label="Next page" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded border border-line bg-subtle p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={clsx('h-8 whitespace-nowrap rounded px-3 text-[13px] font-medium transition-colors', o.value === value ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
