import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { useToasts } from '@/store/toast';
import { Button } from './Button';

export const Skeleton = ({ className }: { className?: string }) => <div className={clsx('animate-pulse rounded bg-subtle', className)} />;

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-3.5">
          <div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-line text-muted"><Icon className="h-5 w-5" /></div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof ApiError ? error.message : 'Couldn’t load this. Try again.';
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <AlertCircle className="mb-3 h-6 w-6 text-danger" />
      <p className="text-sm text-muted">{msg}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Renders skeleton / error / content for a query, so every page handles all three states the same way. */
export function Boundary<T>({ q, skeleton, children }: { q: UseQueryResult<T>; skeleton?: ReactNode; children: (data: T) => ReactNode }) {
  if (q.isPending) return <>{skeleton ?? <ListSkeleton />}</>;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return <>{children(q.data)}</>;
}

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  const icon = { success: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => {
        const Icon = icon[t.kind];
        return (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className="anim-rise pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-line bg-fg px-3.5 py-3 text-sm text-bg shadow-pop">
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
