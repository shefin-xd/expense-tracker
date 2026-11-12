import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/States';
import { ErrorState } from '@/components/ui/States';
import { ApiError } from '@/services/api';
import { useMe } from '@/services/queries';

export function RequireAuth() {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) {
    return (
      <div role="status" aria-label="Loading" className="mx-auto max-w-3xl space-y-4 p-8">
        <Skeleton className="h-6 w-40" /><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (me.error) {
    if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    return <div className="mx-auto max-w-md p-8"><ErrorState message={me.error.message} onRetry={() => me.refetch()} /></div>;
  }
  return <Outlet />;
}

/** Login and register pages bounce signed-in users straight to the dashboard. */
export function GuestOnly() {
  const me = useMe();
  if (me.isPending) return null;
  if (me.data) return <Navigate to="/" replace />;
  return <Outlet />;
}
