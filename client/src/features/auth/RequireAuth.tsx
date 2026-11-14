import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { ApiError } from '@/services/api';
import { useMe } from '@/services/queries';
import { loginUrl, nav } from '@/utils/auth';

/** Signed-out visitors are sent to the separate sign-in app and brought back here afterwards. */
export function RequireAuth() {
  const me = useMe();
  const signedOut = me.error instanceof ApiError && me.error.status === 401;
  useEffect(() => { if (signedOut) nav.replace(loginUrl()); }, [signedOut]);

  if (me.isPending || signedOut) {
    return (
      <div role="status" aria-label={signedOut ? 'Taking you to sign in' : 'Loading'} className="mx-auto max-w-3xl space-y-4 p-8">
        <Skeleton className="h-8 w-44" /><Skeleton className="h-28 w-full !rounded-2xl" /><Skeleton className="h-48 w-full !rounded-2xl" />
      </div>
    );
  }
  if (me.error) return <div className="mx-auto max-w-md p-8"><ErrorState message={me.error.message} onRetry={() => me.refetch()} /></div>;
  return <Outlet />;
}
