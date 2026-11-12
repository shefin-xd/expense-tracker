import { Budget } from './Budget';
import { Category } from './Category';
import { Expense } from './Expense';
import { Fee, FeePayment } from './Fee';
import { Income } from './Income';
import { LedgerEntry } from './LedgerEntry';
import { Loan } from './Loan';
import { Notification } from './Notification';
import { PasswordReset } from './PasswordReset';
import { SavingsGoal } from './SavingsGoal';

/** Every collection that stores a user's private data. Used for export and account deletion. */
export const USER_OWNED = {
  categories: Category,
  expenses: Expense,
  income: Income,
  fees: Fee,
  feePayments: FeePayment,
  loans: Loan,
  budgets: Budget,
  savingsGoals: SavingsGoal,
  notifications: Notification,
  ledger: LedgerEntry,
  passwordResets: PasswordReset,
} as const;
