import type { DateFormat } from './dates';

export type Theme = 'light' | 'dark' | 'system';
export interface Preferences {
  theme: Theme;
  currency: 'INR';
  dateFormat: DateFormat;
  timezone: string;
  notifications: { feeDeadlines: boolean; budgetWarnings: boolean; repayments: boolean };
}
export interface User {
  id: string; name: string; email: string;
  college: string | null; department: string; studentYear: string; hostel: string | null;
  preferences: Preferences;
}

export interface PageMeta { page: number; limit: number; total: number; totalPages: number }
export interface Paged<T> { items: T[]; meta: PageMeta }

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'debit_card' | 'credit_card' | 'other';
export type IncomeSource = 'parents' | 'pocket_money' | 'relatives' | 'scholarship' | 'part_time' | 'freelancing' | 'internship' | 'refund' | 'other';
export type FeeCategory = 'tuition' | 'university_exam' | 'admission' | 'hostel' | 'mess' | 'library' | 'lab' | 'transportation' | 'other_academic';
export type FeeStatus = 'paid' | 'partially_paid' | 'pending' | 'overdue';
export type LoanStatus = 'pending' | 'partially_settled' | 'settled' | 'overdue';
export type LoanDirection = 'lent' | 'borrowed';
export type LedgerKind = 'income' | 'expense' | 'fee_payment' | 'lend_out' | 'lend_repayment' | 'borrow_in' | 'borrow_repayment';

export interface Expense {
  id: string; title: string; amountPaise: number; category: string; date: string;
  paymentMethod: PaymentMethod; description?: string; notes?: string; receiptUrl?: string;
}
export interface Income {
  id: string; source: IncomeSource; amountPaise: number; date: string;
  description?: string; paymentMethod: PaymentMethod; notes?: string;
}
export interface FeePayment { id: string; feeId: string; amountPaise: number; date: string; referenceNo?: string; notes?: string }
export interface Fee {
  id: string; title: string; category: FeeCategory; academicYear: string;
  totalPaise: number; paidPaise: number; remainingPaise: number; dueDate: string;
  status: FeeStatus; notes?: string;
}
export interface FeeDetail extends Fee { payments: FeePayment[] }
export interface Repayment { id: string; amountPaise: number; date: string; notes?: string }
export interface Loan {
  id: string; direction: LoanDirection; person: string; amountPaise: number; repaidPaise: number;
  remainingPaise: number; date: string; expectedDate?: string; notes?: string;
  status: LoanStatus; repayments: Repayment[];
}
export interface LoanTotals { totalPaise: number; repaidPaise: number; outstandingPaise: number }
export interface LedgerEntry { id: string; kind: LedgerKind; amountPaise: number; date: string; title: string; category?: string; sourceType: string; sourceId: string }

export interface Categories { defaults: string[]; custom: { id: string; name: string }[] }
export interface ParentSummary { totalPaise: number; thisMonthPaise: number; thisYearPaise: number; lastReceivedDate: string | null; history: Income[] }

export type BudgetLevel = 'ok' | 'warning' | 'over';
export interface BudgetLine { limitPaise: number; spentPaise: number; remainingPaise: number; percentUsed: number; level: BudgetLevel }
export interface BudgetProgress {
  month: string; hasBudget: boolean; overall: BudgetLine | null;
  categories: (BudgetLine & { category: string })[];
  spentPaise: number; spendingByCategory: { category: string; totalPaise: number; count: number }[];
}
export interface BudgetCompare { month: string; previousMonth: string; spentPaise: number; previousSpentPaise: number; changePaise: number }

export interface SavingsGoal {
  id: string; name: string; targetPaise: number; savedPaise: number; targetDate?: string; description?: string;
  remainingPaise: number; percentSaved: number; reached: boolean;
}
export interface SavingsList { goals: SavingsGoal[]; totalSavedPaise: number; totalTargetPaise: number }

export interface AppNotification { id: string; type: string; title: string; message: string; read: boolean; createdAt: string }

export interface Dashboard {
  balance: { currentPaise: number; lentOutstandingPaise: number; borrowedOutstandingPaise: number };
  range: { totalIncomePaise: number; totalExpensesPaise: number };
  allTime: { totalIncomePaise: number; totalExpensesPaise: number };
  totalSavingsPaise: number;
  spendingSeries: { date: string; totalPaise: number }[];
  categoryBreakdown: { category: string; totalPaise: number; count: number }[];
  recentTransactions: LedgerEntry[];
  upcoming: { fees: Fee[]; repayments: Loan[] };
}

export interface ReportSummary {
  meta: { label: string; scope: string; from: string; to: string };
  summary: {
    openingPaise: number; incomePaise: number; expensesPaise: number; feePaymentsPaise: number;
    netPaise: number; closingPaise: number; lentOutstandingPaise: number; borrowedOutstandingPaise: number; savingsPaise: number;
  };
  categories: { category: string; totalPaise: number; count: number; sharePercent?: number }[];
  transactionCount: number;
}
