import { assertPaise } from '../utils/money';

/**
 * Pure ledger rules (no database). Every financial rule from the spec lives here
 * so it can be unit-tested exhaustively.
 */
export const LEDGER_KINDS = [
  'income', //            +  counts as income
  'expense', //           -  counts as expense
  'fee_payment', //       -  only actual payments; unpaid fees never post
  'lend_out', //          -  money given to a friend (receivable)
  'lend_repayment', //    +  friend paid back; NOT income
  'borrow_in', //         +  cash in, but a liability; NOT income
  'borrow_repayment', //  -  paying back a friend; NOT an expense
] as const;

export type LedgerKind = (typeof LEDGER_KINDS)[number];

const SIGN: Record<LedgerKind, 1 | -1> = {
  income: 1,
  expense: -1,
  fee_payment: -1,
  lend_out: -1,
  lend_repayment: 1,
  borrow_in: 1,
  borrow_repayment: -1,
};

export function signedAmount(kind: LedgerKind, amountPaise: number): number {
  assertPaise(amountPaise);
  return SIGN[kind] * amountPaise;
}

export type KindTotals = Partial<Record<LedgerKind, number>>;

export interface LedgerSummary {
  balancePaise: number;
  totalIncomePaise: number;
  totalExpensesPaise: number; // expenses + actual fee payments
  feePaymentsPaise: number;
  lentOutstandingPaise: number; // friends still owe you
  borrowedOutstandingPaise: number; // you still owe friends
}

export function summarizeTotals(t: KindTotals): LedgerSummary {
  const g = (k: LedgerKind) => t[k] ?? 0;
  const balancePaise = LEDGER_KINDS.reduce((sum, k) => sum + SIGN[k] * g(k), 0);
  return {
    balancePaise,
    totalIncomePaise: g('income'),
    totalExpensesPaise: g('expense') + g('fee_payment'),
    feePaymentsPaise: g('fee_payment'),
    lentOutstandingPaise: g('lend_out') - g('lend_repayment'),
    borrowedOutstandingPaise: g('borrow_in') - g('borrow_repayment'),
  };
}

/** Which ledger kinds the transactions page treats as money in vs money out. */
export const INCOME_KINDS: LedgerKind[] = ['income'];
export const EXPENSE_KINDS: LedgerKind[] = ['expense', 'fee_payment'];
