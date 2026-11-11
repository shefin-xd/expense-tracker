/** Pure status rules for fees, loans and budgets. */

export type FeeStatus = 'paid' | 'partially_paid' | 'pending' | 'overdue';

export function feeStatus(f: { totalPaise: number; paidPaise: number; dueDate: Date }, now = new Date()): FeeStatus {
  if (f.paidPaise >= f.totalPaise) return 'paid';
  if (f.dueDate.getTime() < now.getTime()) return 'overdue';
  return f.paidPaise > 0 ? 'partially_paid' : 'pending';
}

export type LoanStatus = 'settled' | 'partially_settled' | 'pending' | 'overdue';

export function loanStatus(l: { amountPaise: number; repaidPaise: number; expectedDate?: Date | null }, now = new Date()): LoanStatus {
  if (l.repaidPaise >= l.amountPaise) return 'settled';
  if (l.expectedDate && l.expectedDate.getTime() < now.getTime()) return 'overdue';
  return l.repaidPaise > 0 ? 'partially_settled' : 'pending';
}

export type BudgetLevel = 'ok' | 'warning' | 'over';
export const BUDGET_WARNING_RATIO = 0.8;

export function budgetLevel(spentPaise: number, limitPaise: number): BudgetLevel {
  if (spentPaise >= limitPaise) return 'over';
  // integer math: spent/limit >= 0.8  <=>  spent*5 >= limit*4
  return spentPaise * 5 >= limitPaise * 4 ? 'warning' : 'ok';
}

export function percent(partPaise: number, wholePaise: number): number {
  return wholePaise <= 0 ? 0 : Math.min(100, Math.floor((partPaise * 100) / wholePaise));
}
