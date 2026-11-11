import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateData } from '@/lib/query';
import type { Income, IncomeSource, ParentSummary, PaymentMethod } from '@/lib/types';

export interface IncomeFilters { page: number; search?: string; source?: string; from?: string; to?: string; sortBy: 'date' | 'amount'; order: 'asc' | 'desc' }
export interface IncomePayload { source: IncomeSource; amount: string; date: string; paymentMethod: PaymentMethod; description?: string; notes?: string }

export const useIncomeList = (f: IncomeFilters) =>
  useQuery({ queryKey: ['income', f], queryFn: () => api.list<Income>('/income', { ...f, limit: 20 }), placeholderData: (p) => p });
export const useParentSummary = () => useQuery({ queryKey: ['income', 'parent-summary'], queryFn: () => api.get<ParentSummary>('/income/parent-summary') });
export const useSaveIncome = (id?: string) =>
  useMutation({ mutationFn: (b: IncomePayload) => (id ? api.patch<Income>(`/income/${id}`, b) : api.post<Income>('/income', b)), onSuccess: invalidateData });
export const useDeleteIncome = () => useMutation({ mutationFn: (id: string) => api.del(`/income/${id}`), onSuccess: invalidateData });
