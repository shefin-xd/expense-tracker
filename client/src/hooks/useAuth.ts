import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { DateFormat } from '@/lib/dates';
import type { User } from '@/lib/types';

export const ME_KEY = ['me'] as const;

/** Resolves to the signed-in user, or null when there is no valid session. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try { return (await api.get<{ user: User }>('/auth/me')).user; }
      catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useUser(): User {
  const { data } = useMe();
  if (!data) throw new Error('useUser called without a session');
  return data;
}
export const useDateFormat = (): DateFormat => useMe().data?.preferences?.dateFormat ?? 'DD/MM/YYYY';

export interface RegisterInput {
  name: string; email: string; password: string; college?: string; department: string; studentYear: string; hostel?: string;
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { email: string; password: string }) => api.post<{ user: User }>('/auth/login', b),
    onSuccess: (r) => { qc.clear(); qc.setQueryData(ME_KEY, r.user); },
  });
}
export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: RegisterInput) => api.post<{ user: User }>('/auth/register', b),
    onSuccess: (r) => { qc.clear(); qc.setQueryData(ME_KEY, r.user); },
  });
}
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => { qc.clear(); qc.setQueryData(ME_KEY, null); },
  });
}
