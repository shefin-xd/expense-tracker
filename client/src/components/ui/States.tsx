import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={clsx('cl-skeleton', className)} />;

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y overflow-hidden rounded-2xl bg-surface shadow-card">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex flex-1 items-center gap-3"><Skeleton className="size-9 shrink-0 !rounded-[9px]" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-1/4" /></div></div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-6 py-12 text-center shadow-card">
      <p className="text-[17px] font-semibold">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-[15px] text-muted">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-surface px-6 py-10 text-center shadow-card">
      <CircleAlert className="mx-auto size-6 text-danger" aria-hidden />
      <p className="mt-3 text-[17px] font-semibold">Could not load this</p>
      <p className="mx-auto mt-1 max-w-sm text-[15px] text-muted">{message ?? 'Something went wrong. Check your connection and try again.'}</p>
      {onRetry && <div className="mt-5 flex justify-center"><Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button></div>}
    </div>
  );
}
