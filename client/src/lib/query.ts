import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
    },
  },
});

/** Money data is derived from one ledger, so after any write everything except the session is refetched. */
export const invalidateData = () => queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });

export const invalidateNotifications = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
