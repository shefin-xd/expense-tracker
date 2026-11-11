import type { FeeCategory, FeeStatus, IncomeSource, LedgerKind, LoanStatus, PaymentMethod } from './types';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'upi', label: 'UPI' }, { value: 'cash', label: 'Cash' }, { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'debit_card', label: 'Debit card' }, { value: 'credit_card', label: 'Credit card' }, { value: 'other', label: 'Other' },
];
export const methodLabel = (m: string) => PAYMENT_METHODS.find((p) => p.value === m)?.label ?? m;

export const INCOME_SOURCES: { value: IncomeSource; label: string }[] = [
  { value: 'parents', label: 'Money from parents' }, { value: 'pocket_money', label: 'Monthly pocket money' },
  { value: 'relatives', label: 'Money from relatives' }, { value: 'scholarship', label: 'Scholarship' },
  { value: 'part_time', label: 'Part-time work' }, { value: 'freelancing', label: 'Freelancing' },
  { value: 'internship', label: 'Internship' }, { value: 'refund', label: 'Refund' }, { value: 'other', label: 'Other income' },
];
export const sourceLabel = (s: string) => INCOME_SOURCES.find((p) => p.value === s)?.label ?? s;

export const FEE_CATEGORIES: { value: FeeCategory; label: string }[] = [
  { value: 'tuition', label: 'College tuition' }, { value: 'university_exam', label: 'University examination' },
  { value: 'admission', label: 'Admission' }, { value: 'hostel', label: 'Hostel' }, { value: 'mess', label: 'Mess' },
  { value: 'library', label: 'Library' }, { value: 'lab', label: 'Lab' }, { value: 'transportation', label: 'Transportation' },
  { value: 'other_academic', label: 'Other academic' },
];
export const feeCategoryLabel = (c: string) => FEE_CATEGORIES.find((p) => p.value === c)?.label ?? c;

export const FEE_STATUS: Record<FeeStatus, string> = { paid: 'Paid', partially_paid: 'Partially paid', pending: 'Pending', overdue: 'Overdue' };
export const LOAN_STATUS: Record<LoanStatus, string> = { pending: 'Pending', partially_settled: 'Partially settled', settled: 'Settled', overdue: 'Overdue' };

export const STUDENT_YEARS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year', 'Other'] as const;

/** +1 = money in, -1 = money out (mirrors the server ledger rules; used for display only). */
export const KIND_SIGN: Record<LedgerKind, 1 | -1> = {
  income: 1, expense: -1, fee_payment: -1, lend_out: -1, lend_repayment: 1, borrow_in: 1, borrow_repayment: -1,
};
export const KIND_LABEL: Record<LedgerKind, string> = {
  income: 'Income', expense: 'Expense', fee_payment: 'Fee payment', lend_out: 'Lent', lend_repayment: 'Repaid to you',
  borrow_in: 'Borrowed', borrow_repayment: 'You repaid',
};
