export const PAYMENT_METHODS = ['cash', 'upi', 'bank_transfer', 'debit_card', 'credit_card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank transfer', debit_card: 'Debit card', credit_card: 'Credit card', other: 'Other',
};

export const INCOME_SOURCES = ['parents', 'pocket_money', 'relatives', 'scholarship', 'part_time', 'freelancing', 'internship', 'refund', 'other'] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];
export const INCOME_SOURCE_LABELS: Record<IncomeSource, string> = {
  parents: 'Money from parents', pocket_money: 'Monthly pocket money', relatives: 'Money from relatives', scholarship: 'Scholarship',
  part_time: 'Part-time work', freelancing: 'Freelancing', internship: 'Internship', refund: 'Refund', other: 'Other income',
};

export const FEE_CATEGORIES = ['tuition', 'university_exam', 'admission', 'hostel', 'mess', 'library', 'lab', 'transportation', 'other_academic'] as const;
export type FeeCategory = (typeof FEE_CATEGORIES)[number];
export const FEE_CATEGORY_LABELS: Record<FeeCategory, string> = {
  tuition: 'College tuition', university_exam: 'University examination', admission: 'Admission', hostel: 'Hostel', mess: 'Mess',
  library: 'Library', lab: 'Lab', transportation: 'Transportation', other_academic: 'Other academic',
};

export const STUDENT_YEARS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year', 'Other'] as const;
export type StudentYear = (typeof STUDENT_YEARS)[number];

export type Theme = 'light' | 'dark' | 'system';

export interface User {
  id: string; name: string; email: string; college: string | null; department: string; studentYear: StudentYear; hostel: string | null;
  preferences?: {
    theme?: Theme; currency?: string; dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'; timezone?: string;
    notifications?: { feeDeadlines?: boolean; budgetWarnings?: boolean; repayments?: boolean; recurring?: boolean };
  };
}

export interface PageMeta { page: number; limit: number; total: number; totalPages: number }
export interface Paginated<T> { items: T[]; meta: PageMeta }

export interface Expense {
  id: string; title: string; amountPaise: number; category: string; date: string; paymentMethod: PaymentMethod;
  description?: string; notes?: string; receiptUrl?: string;
}
export interface Income { id: string; source: IncomeSource; amountPaise: number; date: string; description?: string; paymentMethod: PaymentMethod; notes?: string }

export type FeeStatus = 'paid' | 'partially_paid' | 'pending' | 'overdue';
export interface Fee {
  id: string; title: string; category: FeeCategory; academicYear: string; totalPaise: number; paidPaise: number; remainingPaise: number;
  dueDate: string; status: FeeStatus; notes?: string;
}
export interface FeePayment { id: string; feeId: string; amountPaise: number; date: string; referenceNo?: string; notes?: string }
export interface FeeDetail extends Fee { payments: FeePayment[] }

export type LoanStatus = 'pending' | 'partially_settled' | 'settled' | 'overdue';
export interface Repayment { id: string; amountPaise: number; date: string; notes?: string }
export interface Loan {
  id: string; direction: 'lent' | 'borrowed'; person: string; amountPaise: number; repaidPaise: number; remainingPaise: number;
  date: string; expectedDate?: string; notes?: string; status: LoanStatus; repayments: Repayment[];
}
export interface LoanTotals { totalPaise: number; repaidPaise: number; outstandingPaise: number }

export type BudgetLevel = 'ok' | 'warning' | 'over';
export interface BudgetLine { limitPaise: number; spentPaise: number; remainingPaise: number; percentUsed: number; level: BudgetLevel }
export interface BudgetProgress {
  month: string; hasBudget: boolean; overall: BudgetLine | null; categories: (BudgetLine & { category: string })[];
  spentPaise: number; spendingByCategory: { category: string; totalPaise: number; count: number }[];
}
export interface BudgetCompare { month: string; previousMonth: string; spentPaise: number; previousSpentPaise: number; changePaise: number }

export interface SavingsGoal {
  id: string; name: string; targetPaise: number; savedPaise: number; remainingPaise: number; percentSaved: number; reached: boolean;
  targetDate?: string; description?: string;
}
export interface SavingsList { goals: SavingsGoal[]; totalSavedPaise: number; totalTargetPaise: number }

export type LedgerKind = 'income' | 'expense' | 'fee_payment' | 'lend_out' | 'lend_repayment' | 'borrow_in' | 'borrow_repayment';
export interface Transaction { id: string; kind: LedgerKind; amountPaise: number; date: string; title: string; category?: string }
export const MONEY_IN: LedgerKind[] = ['income', 'lend_repayment', 'borrow_in'];

export interface Summary {
  balancePaise: number; totalIncomePaise: number; totalExpensesPaise: number; feePaymentsPaise: number;
  lentOutstandingPaise: number; borrowedOutstandingPaise: number;
}

export interface Dashboard {
  balance: { currentPaise: number; lentOutstandingPaise: number; borrowedOutstandingPaise: number };
  range: { totalIncomePaise: number; totalExpensesPaise: number };
  allTime: { totalIncomePaise: number; totalExpensesPaise: number };
  totalSavingsPaise: number;
  spendingSeries: { date: string; totalPaise: number }[];
  categoryBreakdown: { category: string; totalPaise: number; count: number }[];
  recentTransactions: Transaction[];
  upcoming: {
    fees: Fee[];
    repayments: (Loan & { expectedDate: string })[];
  };
}

export interface ParentSummary { totalPaise: number; thisMonthPaise: number; thisYearPaise: number; lastReceivedDate: string | null; history: Income[] }
export interface Categories { defaults: string[]; custom: { id: string; name: string }[] }

export interface AppNotification { id: string; type: string; title: string; message: string; read: boolean; createdAt: string }
export interface NotificationList { items: AppNotification[]; unreadCount: number }

export interface RecurringItem {
  id: string; kind: 'income' | 'expense'; name: string; amountPaise: number; dayOfMonth: number; source?: IncomeSource; category?: string;
  paymentMethod: PaymentMethod; notes?: string; active: boolean; startMonth: string; lastHandledMonth?: string;
  due: boolean; month: string; nextDueDate: string;
}
export interface RecurringList { items: RecurringItem[]; dueCount: number }
