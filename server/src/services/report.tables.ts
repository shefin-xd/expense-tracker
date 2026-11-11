import { INCOME_SOURCE_LABELS } from '../models/constants';
import { signedAmount, type LedgerKind } from './ledger.rules';
import type { ReportData } from './report.service';

export type ColKind = 'text' | 'money' | 'date' | 'int' | 'percent';
export interface Col { header: string; key: string; kind: ColKind; width: number; total?: boolean }
export interface Table { id: TableId; title: string; columns: Col[]; rows: Record<string, unknown>[] }
export type TableId = 'summary' | 'transactions' | 'income' | 'expenses' | 'fees' | 'fee_payments' | 'lent' | 'borrowed' | 'budgets' | 'savings' | 'categories';

const KIND_LABEL: Record<LedgerKind, string> = {
  income: 'Income', expense: 'Expense', fee_payment: 'Fee payment', lend_out: 'Lent to friend',
  lend_repayment: 'Friend paid back', borrow_in: 'Borrowed', borrow_repayment: 'Repaid friend',
};
const METHOD_LABEL: Record<string, string> = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank transfer', debit_card: 'Debit card', credit_card: 'Credit card', other: 'Other' };
const FEE_CATEGORY_LABEL: Record<string, string> = {
  tuition: 'College tuition', university_exam: 'University exam', admission: 'Admission', hostel: 'Hostel', mess: 'Mess',
  library: 'Library', lab: 'Lab', transportation: 'Transportation', other_academic: 'Other academic',
};
const STATUS_LABEL: Record<string, string> = {
  paid: 'Paid', partially_paid: 'Partially paid', pending: 'Pending', overdue: 'Overdue',
  settled: 'Settled', partially_settled: 'Partially settled', ok: 'On track', warning: 'Near limit', over: 'Over budget',
};
const label = (map: Record<string, string>, k: string) => map[k] ?? k;

const loanColumns = (who: string): Col[] => [
  { header: who, key: 'person', kind: 'text', width: 22 },
  { header: 'Amount', key: 'amountPaise', kind: 'money', width: 14, total: true },
  { header: 'Date', key: 'date', kind: 'date', width: 12 },
  { header: 'Expected date', key: 'expectedDate', kind: 'date', width: 14 },
  { header: 'Returned', key: 'repaidPaise', kind: 'money', width: 14, total: true },
  { header: 'Remaining', key: 'remainingPaise', kind: 'money', width: 14, total: true },
  { header: 'Status', key: 'status', kind: 'text', width: 16 },
  { header: 'Notes', key: 'notes', kind: 'text', width: 30 },
];

export function buildTables(d: ReportData): Record<TableId, Table> {
  const loanRows = (rows: ReportData['lent']) => rows.map((l) => ({ ...l, status: label(STATUS_LABEL, l.status) }));
  const s = d.summary;
  return {
    summary: {
      id: 'summary', title: 'Summary',
      columns: [{ header: 'Metric', key: 'metric', kind: 'text', width: 34 }, { header: 'Amount', key: 'amountPaise', kind: 'money', width: 18 }],
      rows: [
        { metric: 'Opening balance', amountPaise: s.openingPaise },
        { metric: 'Total income', amountPaise: s.incomePaise },
        { metric: 'Total expenses (incl. fee payments)', amountPaise: s.expensesPaise },
        { metric: 'Of which fee payments', amountPaise: s.feePaymentsPaise },
        { metric: 'Net change in balance', amountPaise: s.netPaise },
        { metric: 'Remaining balance', amountPaise: s.closingPaise },
        { metric: 'Friends still owe you', amountPaise: s.lentOutstandingPaise },
        { metric: 'You still owe friends', amountPaise: s.borrowedOutstandingPaise },
        { metric: 'Total saved in goals', amountPaise: s.savingsPaise },
      ],
    },
    transactions: {
      id: 'transactions', title: 'Transactions',
      columns: [
        { header: 'Date', key: 'date', kind: 'date', width: 12 },
        { header: 'Title', key: 'title', kind: 'text', width: 34 },
        { header: 'Category', key: 'category', kind: 'text', width: 16 },
        { header: 'Type', key: 'type', kind: 'text', width: 16 },
        { header: 'Money in', key: 'inPaise', kind: 'money', width: 14, total: true },
        { header: 'Money out', key: 'outPaise', kind: 'money', width: 14, total: true },
      ],
      rows: d.transactions.map((t) => {
        const credit = signedAmount(t.kind, t.amountPaise) > 0;
        return { date: t.date, title: t.title, category: t.category, type: KIND_LABEL[t.kind], inPaise: credit ? t.amountPaise : null, outPaise: credit ? null : t.amountPaise };
      }),
    },
    income: {
      id: 'income', title: 'Income',
      columns: [
        { header: 'Date', key: 'date', kind: 'date', width: 12 },
        { header: 'Source', key: 'source', kind: 'text', width: 24 },
        { header: 'Amount', key: 'amountPaise', kind: 'money', width: 14, total: true },
        { header: 'Payment method', key: 'paymentMethod', kind: 'text', width: 16 },
        { header: 'Description', key: 'description', kind: 'text', width: 30 },
        { header: 'Notes', key: 'notes', kind: 'text', width: 30 },
      ],
      rows: d.income.map((i) => ({ ...i, source: label(INCOME_SOURCE_LABELS, i.source), paymentMethod: label(METHOD_LABEL, i.paymentMethod) })),
    },
    expenses: {
      id: 'expenses', title: 'Expenses',
      columns: [
        { header: 'Date', key: 'date', kind: 'date', width: 12 },
        { header: 'Title', key: 'title', kind: 'text', width: 28 },
        { header: 'Category', key: 'category', kind: 'text', width: 16 },
        { header: 'Amount', key: 'amountPaise', kind: 'money', width: 14, total: true },
        { header: 'Payment method', key: 'paymentMethod', kind: 'text', width: 16 },
        { header: 'Description', key: 'description', kind: 'text', width: 28 },
        { header: 'Notes', key: 'notes', kind: 'text', width: 28 },
        { header: 'Receipt', key: 'receiptUrl', kind: 'text', width: 24 },
      ],
      rows: d.expenses.map((e) => ({ ...e, paymentMethod: label(METHOD_LABEL, e.paymentMethod) })),
    },
    fees: {
      id: 'fees', title: 'Fees',
      columns: [
        { header: 'Fee', key: 'title', kind: 'text', width: 28 },
        { header: 'Category', key: 'category', kind: 'text', width: 18 },
        { header: 'Academic year', key: 'academicYear', kind: 'text', width: 14 },
        { header: 'Total due', key: 'totalPaise', kind: 'money', width: 14, total: true },
        { header: 'Paid', key: 'paidPaise', kind: 'money', width: 14, total: true },
        { header: 'Remaining', key: 'remainingPaise', kind: 'money', width: 14, total: true },
        { header: 'Due date', key: 'dueDate', kind: 'date', width: 12 },
        { header: 'Status', key: 'status', kind: 'text', width: 16 },
        { header: 'Notes', key: 'notes', kind: 'text', width: 28 },
      ],
      rows: d.fees.map((f) => ({ ...f, category: label(FEE_CATEGORY_LABEL, f.category), status: label(STATUS_LABEL, f.status) })),
    },
    fee_payments: {
      id: 'fee_payments', title: 'Fee payments',
      columns: [
        { header: 'Date', key: 'date', kind: 'date', width: 12 },
        { header: 'Fee', key: 'fee', kind: 'text', width: 30 },
        { header: 'Amount', key: 'amountPaise', kind: 'money', width: 14, total: true },
        { header: 'Reference no.', key: 'referenceNo', kind: 'text', width: 20 },
        { header: 'Notes', key: 'notes', kind: 'text', width: 30 },
      ],
      rows: d.feePayments.map((p) => ({ ...p })),
    },
    lent: { id: 'lent', title: 'Money lent', columns: loanColumns('Friend'), rows: loanRows(d.lent) },
    borrowed: { id: 'borrowed', title: 'Money borrowed', columns: loanColumns('Friend'), rows: loanRows(d.borrowed) },
    budgets: {
      id: 'budgets', title: 'Budgets',
      columns: [
        { header: 'Month', key: 'month', kind: 'text', width: 10 },
        { header: 'Budget', key: 'scope', kind: 'text', width: 20 },
        { header: 'Limit', key: 'limitPaise', kind: 'money', width: 14 },
        { header: 'Spent', key: 'spentPaise', kind: 'money', width: 14 },
        { header: 'Remaining', key: 'remainingPaise', kind: 'money', width: 14 },
        { header: 'Used %', key: 'percentUsed', kind: 'percent', width: 10 },
        { header: 'Status', key: 'level', kind: 'text', width: 14 },
      ],
      rows: d.budgets.map((b) => ({ ...b, level: label(STATUS_LABEL, b.level) })),
    },
    savings: {
      id: 'savings', title: 'Savings goals',
      columns: [
        { header: 'Goal', key: 'name', kind: 'text', width: 24 },
        { header: 'Target', key: 'targetPaise', kind: 'money', width: 14, total: true },
        { header: 'Saved', key: 'savedPaise', kind: 'money', width: 14, total: true },
        { header: 'Remaining', key: 'remainingPaise', kind: 'money', width: 14, total: true },
        { header: 'Progress %', key: 'percent', kind: 'percent', width: 10 },
        { header: 'Target date', key: 'targetDate', kind: 'date', width: 12 },
        { header: 'Description', key: 'description', kind: 'text', width: 30 },
      ],
      rows: d.savings.map((g) => ({ ...g })),
    },
    categories: {
      id: 'categories', title: 'Spending by category',
      columns: [
        { header: 'Category', key: 'category', kind: 'text', width: 24 },
        { header: 'Entries', key: 'count', kind: 'int', width: 10 },
        { header: 'Total', key: 'totalPaise', kind: 'money', width: 16, total: true },
        { header: 'Share %', key: 'share', kind: 'percent', width: 10 },
      ],
      rows: d.categories.map((c) => ({ ...c })),
    },
  };
}

export const sumColumn = (t: Table, key: string): number => t.rows.reduce<number>((sum, r) => sum + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0);
