import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateData } from '@/lib/query';
import type { Categories, Expense, PaymentMethod } from '@/lib/types';

export interface ExpenseFilters {
  page: number; search?: string; category?: string; paymentMethod?: string; from?: string; to?: string;
  sortBy: 'date' | 'amount'; order: 'asc' | 'desc';
}
export interface ExpensePayload {
  title: string; amount: string; category: string; date: string; paymentMethod: PaymentMethod;
  description?: string; notes?: string; receiptUrl?: string;
}

export const useExpenses = (f: ExpenseFilters) =>
  useQuery({ queryKey: ['expenses', f], queryFn: () => api.list<Expense>('/expenses', { ...f, limit: 20 }), placeholderData: (p) => p });

export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => api.get<Categories>('/categories'), staleTime: 5 * 60_000 });

export function useSaveExpense(id?: string) {
  return useMutation({
    mutationFn: (b: ExpensePayload) => (id ? api.patch<Expense>(`/expenses/${id}`, b) : api.post<Expense>('/expenses', b)),
    onSuccess: invalidateData,
  });
}
export const useDeleteExpense = () => useMutation({ mutationFn: (id: string) => api.del(`/expenses/${id}`), onSuccess: invalidateData });

export function useCategoryMutations() {
  const qc = useQueryClient();
  const done = () => { void qc.invalidateQueries({ queryKey: ['categories'] }); void invalidateData(); };
  return {
    create: useMutation({ mutationFn: (name: string) => api.post('/categories', { name }), onSuccess: done }),
    rename: useMutation({ mutationFn: (v: { id: string; name: string }) => api.patch(`/categories/${v.id}`, { name: v.name }), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/categories/${id}`), onSuccess: done }),
  };
}
