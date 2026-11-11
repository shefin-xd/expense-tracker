import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateData } from '@/lib/query';
import type { BudgetCompare, BudgetProgress } from '@/lib/types';

export interface BudgetPayload { overall?: string; categories: { category: string; limit: string }[] }
export const useBudget = (month: string) => useQuery({ queryKey: ['budgets', month], queryFn: () => api.get<BudgetProgress>(`/budgets/${month}`), placeholderData: (p) => p });
export const useBudgetCompare = (month: string) => useQuery({ queryKey: ['budgets', month, 'compare'], queryFn: () => api.get<BudgetCompare>(`/budgets/${month}/compare`), placeholderData: (p) => p });
export const useSaveBudget = (month: string) => useMutation({ mutationFn: (b: BudgetPayload) => api.put(`/budgets/${month}`, b), onSuccess: invalidateData });
