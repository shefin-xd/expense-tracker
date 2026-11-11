import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateData } from '@/lib/query';
import type { SavingsGoal, SavingsList } from '@/lib/types';

export interface GoalPayload { name: string; target?: string; saved?: string; targetDate?: string; description?: string }
export const useGoals = () => useQuery({ queryKey: ['savings'], queryFn: () => api.get<SavingsList>('/savings') });
export const useSaveGoal = (id?: string) =>
  useMutation({ mutationFn: (b: GoalPayload) => (id ? api.patch<SavingsGoal>(`/savings/${id}`, b) : api.post<SavingsGoal>('/savings', b)), onSuccess: invalidateData });
export const useDeleteGoal = () => useMutation({ mutationFn: (id: string) => api.del(`/savings/${id}`), onSuccess: invalidateData });
