import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useRef } from 'react';
import { uuid } from '@/utils/uuid';
import { toast } from '@/store/toast';
import type * as T from '@/types/api';
import { api, ApiError, withIdempotencyKey } from './api';

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

/** All money data is derived from one ledger on the server, so after any write we refetch everything. */
export function useSave<V, R = unknown>(fn: (v: V) => Promise<R>, success?: string, onDone?: (r: R) => void) {
  const qc = useQueryClient();
  // One key per form submission. Retrying the same values after a lost response reuses it, so the server
  // can never record the money twice; changed values or a finished save get a fresh key.
  const attempt = useRef<{ fingerprint: string; key: string }>({ fingerprint: '', key: uuid() });
  return useMutation({
    mutationFn: (v: V) => {
      const fingerprint = JSON.stringify(v) ?? '';
      if (attempt.current.fingerprint !== fingerprint) attempt.current = { fingerprint, key: uuid() };
      return withIdempotencyKey(attempt.current.key, () => fn(v));
    },
    onSuccess: async (r) => {
      attempt.current = { fingerprint: '', key: uuid() };
      await qc.invalidateQueries();
      if (success) toast.success(success);
      onDone?.(r);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

const list = <R>(key: QueryKey, path: string, query: Record<string, string | number | undefined | null>) =>
  useQuery({ queryKey: [...key, query], queryFn: () => api.page<R>(path, query), placeholderData: keepPreviousData });

// ---- auth / user
export const useMe = () => useQuery({ queryKey: ['me'], queryFn: async () => (await api.get<{ user: T.User }>('/auth/me')).user, retry: false, staleTime: 5 * 60_000 });

// ---- dashboard + summary
export const useDashboard = (q: { from: string; to: string }) => useQuery({ queryKey: ['dashboard', q], queryFn: () => api.get<T.Dashboard>('/dashboard', q), placeholderData: keepPreviousData });

// ---- transactions
export const useTransactions = (q: Record<string, string | number | undefined | null>) => list<T.Transaction>(['transactions'], '/transactions', q);

// ---- categories
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => api.get<T.Categories>('/categories') });

// ---- expenses / income
export const useExpenses = (q: Record<string, string | number | undefined | null>) => list<T.Expense>(['expenses'], '/expenses', q);
export const useIncome = (q: Record<string, string | number | undefined | null>) => list<T.Income>(['income'], '/income', q);
export const useParentSummary = () => useQuery({ queryKey: ['parent-summary'], queryFn: () => api.get<T.ParentSummary>('/income/parent-summary') });

// ---- fees
export const useFees = (q: Record<string, string | number | undefined | null>) => list<T.Fee>(['fees'], '/fees', q);
export const useFee = (id: string | null) => useQuery({ queryKey: ['fee', id], queryFn: () => api.get<T.FeeDetail>(`/fees/${id}`), enabled: !!id });

// ---- lending / borrowing
export type Direction = 'lending' | 'borrowing';
export const useLoans = (d: Direction, q: Record<string, string | number | undefined | null>) => list<T.Loan>(['loans', d], `/${d}`, q);
export const useLoanTotals = (d: Direction) => useQuery({ queryKey: ['loan-totals', d], queryFn: () => api.get<T.LoanTotals>(`/${d}/summary`) });

// ---- budgets / savings
export const useBudget = (month: string) => useQuery({ queryKey: ['budget', month], queryFn: () => api.get<T.BudgetProgress>(`/budgets/${month}`) });
export const useBudgetCompare = (month: string) => useQuery({ queryKey: ['budget-compare', month], queryFn: () => api.get<T.BudgetCompare>(`/budgets/${month}/compare`) });
export const useSavings = () => useQuery({ queryKey: ['savings'], queryFn: () => api.get<T.SavingsList>('/savings') });

// ---- recurring items
export const useRecurring = () => useQuery({ queryKey: ['recurring'], queryFn: () => api.get<T.RecurringList>('/recurring') });

// ---- notifications
export const useNotifications = () => useQuery({ queryKey: ['notifications'], queryFn: () => api.get<T.NotificationList>('/notifications'), refetchInterval: 120_000 });
