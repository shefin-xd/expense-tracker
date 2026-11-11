import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateData } from '@/lib/query';
import type { Loan, LoanDirection, LoanTotals } from '@/lib/types';

export const loanPath = (d: LoanDirection) => (d === 'lent' ? '/lending' : '/borrowing');
export interface LoanPayload { person: string; amount: string; date: string; expectedDate?: string; notes?: string }
export interface RepaymentPayload { amount: string; date: string; notes?: string }

export const useLoans = (d: LoanDirection) => useQuery({ queryKey: ['loans', d], queryFn: () => api.list<Loan>(loanPath(d), { limit: 100 }) });
export const useLoanTotals = (d: LoanDirection) => useQuery({ queryKey: ['loans', d, 'summary'], queryFn: () => api.get<LoanTotals>(`${loanPath(d)}/summary`) });
export const useSaveLoan = (d: LoanDirection, id?: string) =>
  useMutation({ mutationFn: (b: LoanPayload) => (id ? api.patch<Loan>(`${loanPath(d)}/${id}`, b) : api.post<Loan>(loanPath(d), b)), onSuccess: invalidateData });
export const useDeleteLoan = (d: LoanDirection) => useMutation({ mutationFn: (id: string) => api.del(`${loanPath(d)}/${id}`), onSuccess: invalidateData });
export const useAddRepayment = (d: LoanDirection, id: string) =>
  useMutation({ mutationFn: (b: RepaymentPayload) => api.post(`${loanPath(d)}/${id}/repayments`, b), onSuccess: invalidateData });
export const useDeleteRepayment = (d: LoanDirection) =>
  useMutation({ mutationFn: (v: { id: string; repaymentId: string }) => api.del(`${loanPath(d)}/${v.id}/repayments/${v.repaymentId}`), onSuccess: invalidateData });
