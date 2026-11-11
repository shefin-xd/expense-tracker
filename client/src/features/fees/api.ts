import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateData } from '@/lib/query';
import type { Fee, FeeCategory, FeeDetail } from '@/lib/types';

export interface FeePayload { title: string; category: FeeCategory; academicYear: string; total: string; dueDate: string; notes?: string }
export interface PaymentPayload { amount: string; date: string; referenceNo?: string; notes?: string }

/** A student has a handful of fees per year, so all are loaded once and filtered on screen. */
export const useFees = () => useQuery({ queryKey: ['fees'], queryFn: () => api.list<Fee>('/fees', { limit: 100 }) });
export const useFee = (id: string | null) => useQuery({ queryKey: ['fees', id], queryFn: () => api.get<FeeDetail>(`/fees/${id}`), enabled: !!id });
export const useSaveFee = (id?: string) =>
  useMutation({ mutationFn: (b: FeePayload) => (id ? api.patch<Fee>(`/fees/${id}`, b) : api.post<Fee>('/fees', b)), onSuccess: invalidateData });
export const useDeleteFee = () => useMutation({ mutationFn: (id: string) => api.del(`/fees/${id}`), onSuccess: invalidateData });
export const useAddPayment = (feeId: string) => useMutation({ mutationFn: (b: PaymentPayload) => api.post(`/fees/${feeId}/payments`, b), onSuccess: invalidateData });
export const useCompleteFee = () => useMutation({ mutationFn: (id: string) => api.post(`/fees/${id}/complete`), onSuccess: invalidateData });
export const useDeletePayment = () => useMutation({ mutationFn: (v: { feeId: string; paymentId: string }) => api.del(`/fees/${v.feeId}/payments/${v.paymentId}`), onSuccess: invalidateData });
