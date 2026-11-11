import { Types } from 'mongoose';
import { Expense } from '../models/Expense';
import { Fee, FeePayment } from '../models/Fee';
import { Income } from '../models/Income';
import { LedgerEntry } from '../models/LedgerEntry';
import { Loan } from '../models/Loan';
import { SavingsGoal } from '../models/SavingsGoal';
import { User } from '../models/User';
import type { DateFormat } from '../utils/dates';
import { currentMonthIST, endOfDayIST, formatDateIST, monthLabel, monthRangeIST, monthsBetween, startOfDayIST, yearRangeIST } from '../utils/dates';
import { notFound } from '../utils/errors';
import { getBudgetProgress } from './budget.service';
import { feeView } from './fee.service';
import { getSummary } from './ledger.service';
import { EXPENSE_KINDS, INCOME_KINDS, type LedgerKind } from './ledger.rules';
import { loanView } from './loan.service';

/**
 * Every export (PDF, XLSX, CSV, JSON preview) is rendered from this one structure,
 * and every query below is scoped by userId, so an export can only ever contain
 * the authenticated user's data.
 */
export const MAX_TRANSACTION_ROWS = 20_000;
const MAX_BUDGET_MONTHS = 12;

export type ReportScope = 'all' | 'expenses' | 'income' | 'fees';
export type ReportPeriod = 'month' | 'year' | 'custom';

export interface ReportRange {
  period: ReportPeriod;
  from: Date;
  to: Date;
  label: string;
}

export function resolveRange(q: { month?: string | undefined; year?: number | undefined; from?: Date | undefined; to?: Date | undefined }, now = new Date(), fmt: DateFormat = 'DD/MM/YYYY'): ReportRange {
  if (q.from && q.to) {
    const from = startOfDayIST(q.from);
    const to = endOfDayIST(q.to);
    return { period: 'custom', from, to, label: `${formatDateIST(from, fmt)} to ${formatDateIST(to, fmt)}` };
  }
  if (q.year !== undefined && !q.month) return { period: 'year', ...yearRangeIST(q.year), label: String(q.year) };
  const month = q.month ?? currentMonthIST(now);
  return { period: 'month', ...monthRangeIST(month), label: monthLabel(month) };
}

export interface TxnRow { date: Date; title: string; category: string; kind: LedgerKind; amountPaise: number }
export interface IncomeRow { date: Date; source: string; amountPaise: number; paymentMethod: string; description: string; notes: string }
export interface ExpenseRow { date: Date; title: string; category: string; amountPaise: number; paymentMethod: string; description: string; notes: string; receiptUrl: string }
export interface FeeRow { title: string; category: string; academicYear: string; totalPaise: number; paidPaise: number; remainingPaise: number; dueDate: Date; status: string; notes: string }
export interface FeePaymentRow { date: Date; fee: string; amountPaise: number; referenceNo: string; notes: string }
export interface LoanRow { person: string; amountPaise: number; date: Date; expectedDate: Date | null; repaidPaise: number; remainingPaise: number; status: string; notes: string }
export interface BudgetRow { month: string; scope: string; limitPaise: number; spentPaise: number; remainingPaise: number; percentUsed: number; level: string }
export interface SavingsRow { name: string; targetPaise: number; savedPaise: number; remainingPaise: number; percent: number; targetDate: Date | null; description: string }
export interface CategoryRow { category: string; count: number; totalPaise: number; share: number }

export interface ReportData {
  meta: {
    user: { name: string; email: string; college: string; department: string; studentYear: string; hostel: string };
    scope: ReportScope;
    period: ReportPeriod;
    label: string;
    from: Date;
    to: Date;
    generatedAt: Date;
    dateFormat: DateFormat;
  };
  summary: {
    openingPaise: number;
    incomePaise: number;
    expensesPaise: number; // expenses + actual fee payments
    feePaymentsPaise: number;
    netPaise: number;
    closingPaise: number;
    lentOutstandingPaise: number;
    borrowedOutstandingPaise: number;
    savingsPaise: number;
  };
  categories: CategoryRow[];
  incomeBySource: { source: string; count: number; totalPaise: number }[];
  transactions: TxnRow[];
  transactionCount: number;
  transactionsTruncated: boolean;
  income: IncomeRow[];
  expenses: ExpenseRow[];
  fees: FeeRow[];
  feePayments: FeePaymentRow[];
  lent: LoanRow[];
  borrowed: LoanRow[];
  budgets: BudgetRow[];
  savings: SavingsRow[];
  upcoming: { fees: FeeRow[]; repayments: (LoanRow & { direction: 'lent' | 'borrowed' })[] };
}

const s = (v: unknown) => (typeof v === 'string' ? v : '');
const shareOf = (part: number, whole: number) => (whole <= 0 ? 0 : Math.round((part * 1000) / whole) / 10);

export async function buildReport(userId: string, scope: ReportScope, range: ReportRange, now = new Date()): Promise<ReportData> {
  const user = await User.findById(userId).lean();
  if (!user) throw notFound('User not found');
  const dateFormat = (user.preferences?.dateFormat as DateFormat | undefined) ?? 'DD/MM/YYYY';

  const uid = new Types.ObjectId(userId);
  const inRange = { $gte: range.from, $lte: range.to };
  const wantAll = scope === 'all';
  const wantIncome = wantAll || scope === 'income';
  const wantExpenses = wantAll || scope === 'expenses';
  const wantFees = wantAll || scope === 'fees';

  const txnKinds: LedgerKind[] | null = scope === 'income' ? INCOME_KINDS : scope === 'expenses' ? EXPENSE_KINDS : scope === 'fees' ? ['fee_payment'] : null;
  const txnFilter = { userId: uid, date: inRange, ...(txnKinds ? { kind: { $in: txnKinds } } : {}) };

  const feePaymentsInRange = wantFees ? await FeePayment.find({ userId: uid, date: inRange }).sort({ date: 1, _id: 1 }).lean() : [];
  const feeIdsWithPayments = [...new Set(feePaymentsInRange.map((p) => String(p.feeId)))].map((id) => new Types.ObjectId(id));

  const [opening, during, asOfEnd, txnDocs, txnCount, catRows, srcRows, incomeDocs, expenseDocs, feeDocs, loanDocs, goalDocs] = await Promise.all([
    getSummary(userId, { to: new Date(range.from.getTime() - 1) }),
    getSummary(userId, { from: range.from, to: range.to }),
    getSummary(userId, { to: range.to }),
    LedgerEntry.find(txnFilter).sort({ date: 1, _id: 1 }).limit(MAX_TRANSACTION_ROWS).lean(),
    LedgerEntry.countDocuments(txnFilter),
    wantExpenses
      ? LedgerEntry.aggregate<{ _id: string; total: number; count: number }>([
          { $match: { userId: uid, date: inRange, kind: { $in: EXPENSE_KINDS } } },
          { $group: { _id: { $cond: [{ $eq: ['$kind', 'fee_payment'] }, 'Fee payments', '$category'] }, total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } },
        ])
      : [],
    wantIncome
      ? Income.aggregate<{ _id: string; total: number; count: number }>([
          { $match: { userId: uid, date: inRange } },
          { $group: { _id: '$source', total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } },
        ])
      : [],
    wantIncome ? Income.find({ userId: uid, date: inRange }).sort({ date: 1, _id: 1 }).limit(MAX_TRANSACTION_ROWS).lean() : [],
    wantExpenses ? Expense.find({ userId: uid, date: inRange }).sort({ date: 1, _id: 1 }).limit(MAX_TRANSACTION_ROWS).lean() : [],
    wantFees
      ? Fee.find({
          userId: uid,
          $or: [{ dueDate: inRange }, { _id: { $in: feeIdsWithPayments } }, { $expr: { $lt: ['$paidPaise', '$totalPaise'] } }],
        }).sort({ dueDate: 1 })
      : [],
    wantAll ? Loan.find({ userId: uid, $or: [{ date: inRange }, { $expr: { $lt: ['$repaidPaise', '$amountPaise'] } }] }).sort({ date: 1 }) : [],
    wantAll ? SavingsGoal.find({ userId: uid }).sort({ createdAt: -1 }).lean() : [],
  ]);

  const categoryTotal = catRows.reduce((sum, r) => sum + r.total, 0);
  const categories: CategoryRow[] = catRows.map((r) => ({ category: r._id, count: r.count, totalPaise: r.total, share: shareOf(r.total, categoryTotal) }));

  const feeViews = feeDocs.map((f) => feeView(f, now));
  const feeRows: FeeRow[] = feeViews.map((f) => ({
    title: f.title, category: f.category, academicYear: f.academicYear, totalPaise: f.totalPaise, paidPaise: f.paidPaise,
    remainingPaise: f.remainingPaise, dueDate: f.dueDate, status: f.status, notes: s(f.notes),
  }));
  const feeTitle = new Map(feeViews.map((f) => [String(f._id), f.title]));

  const toLoanRow = (l: ReturnType<typeof loanView>): LoanRow => ({
    person: l.person, amountPaise: l.amountPaise, date: l.date, expectedDate: l.expectedDate ?? null,
    repaidPaise: l.repaidPaise, remainingPaise: l.remainingPaise, status: l.status, notes: s(l.notes),
  });
  const loanViews = loanDocs.map((l) => loanView(l, now));
  const lent = loanViews.filter((l) => l.direction === 'lent').map(toLoanRow);
  const borrowed = loanViews.filter((l) => l.direction === 'borrowed').map(toLoanRow);

  const budgetMonths = wantAll ? monthsBetween(range.from, range.to).slice(-MAX_BUDGET_MONTHS) : [];
  const budgets: BudgetRow[] = [];
  for (const month of budgetMonths) {
    const p = await getBudgetProgress(userId, month);
    if (!p.hasBudget) continue;
    if (p.overall) budgets.push({ month, scope: 'Overall', limitPaise: p.overall.limitPaise, spentPaise: p.overall.spentPaise, remainingPaise: p.overall.remainingPaise, percentUsed: p.overall.percentUsed, level: p.overall.level });
    for (const c of p.categories) budgets.push({ month, scope: c.category, limitPaise: c.limitPaise, spentPaise: c.spentPaise, remainingPaise: c.remainingPaise, percentUsed: c.percentUsed, level: c.level });
  }

  const savings: SavingsRow[] = goalDocs.map((g) => ({
    name: g.name, targetPaise: g.targetPaise, savedPaise: g.savedPaise, remainingPaise: Math.max(0, g.targetPaise - g.savedPaise),
    percent: Math.min(100, Math.floor((g.savedPaise * 100) / g.targetPaise)), targetDate: g.targetDate ?? null, description: s(g.description),
  }));

  return {
    meta: {
      user: { name: user.name, email: user.email, college: s(user.college), department: user.department, studentYear: user.studentYear, hostel: s(user.hostel) },
      scope, period: range.period, label: range.label, from: range.from, to: range.to, generatedAt: now, dateFormat,
    },
    summary: {
      openingPaise: opening.balancePaise,
      incomePaise: during.totalIncomePaise,
      expensesPaise: during.totalExpensesPaise,
      feePaymentsPaise: during.feePaymentsPaise,
      netPaise: asOfEnd.balancePaise - opening.balancePaise,
      closingPaise: asOfEnd.balancePaise,
      lentOutstandingPaise: asOfEnd.lentOutstandingPaise,
      borrowedOutstandingPaise: asOfEnd.borrowedOutstandingPaise,
      savingsPaise: wantAll ? savings.reduce((sum, g) => sum + g.savedPaise, 0) : 0,
    },
    categories,
    incomeBySource: srcRows.map((r) => ({ source: r._id, count: r.count, totalPaise: r.total })),
    transactions: txnDocs.map((t) => ({ date: t.date, title: t.title, category: s(t.category), kind: t.kind as LedgerKind, amountPaise: t.amountPaise })),
    transactionCount: txnCount,
    transactionsTruncated: txnCount > txnDocs.length,
    income: incomeDocs.map((i) => ({ date: i.date, source: i.source, amountPaise: i.amountPaise, paymentMethod: s(i.paymentMethod), description: s(i.description), notes: s(i.notes) })),
    expenses: expenseDocs.map((e) => ({ date: e.date, title: e.title, category: e.category, amountPaise: e.amountPaise, paymentMethod: s(e.paymentMethod), description: s(e.description), notes: s(e.notes), receiptUrl: s(e.receiptUrl) })),
    fees: feeRows,
    feePayments: feePaymentsInRange.map((p) => ({ date: p.date, fee: feeTitle.get(String(p.feeId)) ?? 'Fee', amountPaise: p.amountPaise, referenceNo: s(p.referenceNo), notes: s(p.notes) })),
    lent,
    borrowed,
    budgets,
    savings,
    upcoming: {
      fees: feeRows.filter((f) => f.status !== 'paid'),
      repayments: loanViews
        .filter((l) => l.status !== 'settled' && l.expectedDate)
        .sort((a, b) => +a.expectedDate! - +b.expectedDate!)
        .map((l) => ({ ...toLoanRow(l), direction: l.direction })),
    },
  };
}
