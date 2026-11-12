import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={clsx('cl-skeleton', className)} />;

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y rounded-md border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-1/4" /></div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-md border px-6 py-10 text-center">
      <CircleAlert className="mx-auto size-5 text-danger" aria-hidden />
      <p className="mt-3 text-sm font-medium">Could not load this</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{message ?? 'Something went wrong. Check your connection and try again.'}</p>
      {onRetry && <div className="mt-5 flex justify-center"><Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button></div>}
    </div>
  );
}
