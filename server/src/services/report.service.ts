import { Types } from 'mongoose';
import { Expense } from '../models/Expense';
import { Fee, FeePayment } from '../models/Fee';
import { Income } from '../models/Income';
import { INCOME_SOURCE_LABELS } from '../models/constants';
import { LedgerEntry } from '../models/LedgerEntry';
import { Loan } from '../models/Loan';
import { SavingsGoal } from '../models/SavingsGoal';
import { User } from '../models/User';
import { currentMonthIST, currentYearIST, dayEndIST, dayStartIST, isDateOnly, monthRangeIST, yearRangeIST } from '../utils/dates';
import { badRequest, notFound } from '../utils/errors';
import { getBudgetProgress, spentByCategory } from './budget.service';
import { feeView } from './fee.service';
import { getKindTotals } from './ledger.service';
import { signedAmount, summarizeTotals, type LedgerKind } from './ledger.rules';
import { loanView } from './loan.service';

export const REPORT_TYPES = ['monthly', 'yearly', 'custom', 'expenses', 'income', 'fees'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportParams {
  type: ReportType;
  month?: string | undefined;
  year?: number | undefined;
  from?: string | undefined; // YYYY-MM-DD (IST day) or ISO datetime
  to?: string | undefined;
  academicYear?: string | undefined; // fee reports only
}

const MAX_RANGE_MS = 5 * 366 * 24 * 60 * 60 * 1000;
const MAX_TX_ROWS = 10_000;

const bound = (s: string, edge: 'start' | 'end') => (isDateOnly(s) ? (edge === 'start' ? dayStartIST(s) : dayEndIST(s)) : new Date(s));

/** Works out the date range for a report; monthly/yearly use IST calendar months/years. */
export function resolveRange(p: ReportParams, now = new Date()): { from: Date; to: Date; label: string } {
  if (p.type === 'custom' && !(p.from && p.to)) throw badRequest('Custom reports need both from and to dates');
  let range: { from: Date; to: Date; label: string };
  if (p.from && p.to && p.type !== 'monthly' && p.type !== 'yearly') {
    range = { from: bound(p.from, 'start'), to: bound(p.to, 'end'), label: `${p.from.slice(0, 10)}_to_${p.to.slice(0, 10)}` };
  } else if (p.type === 'yearly' || (!p.month && p.year !== undefined)) {
    const y = p.year ?? currentYearIST(now);
    range = { ...yearRangeIST(y), label: String(y) };
  } else {
    const m = p.month ?? currentMonthIST(now);
    range = { ...monthRangeIST(m), label: m };
  }
  if (Number.isNaN(range.from.getTime()) || Number.isNaN(range.to.getTime())) throw badRequest('Invalid date range');
  if (range.from > range.to) throw badRequest('"from" must be on or before "to"');
  if (range.to.getTime() - range.from.getTime() > MAX_RANGE_MS) throw badRequest('Reports can cover at most 5 years');
  return range;
}

export async function buildReport(userId: string, p: ReportParams, now = new Date()) {
  const range = resolveRange(p, now);
  const uid = new Types.ObjectId(userId);
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');

  const feeFilter: Record<string, unknown> = { userId };
  if (p.type === 'fees' && p.academicYear) feeFilter.academicYear = p.academicYear;

  const [before, inRange, categories, ledger, incomeDocs, expenseDocs, feeDocs, loanDocs, goals] = await Promise.all([
    getKindTotals(userId, { to: new Date(range.from.getTime() - 1) }),
    getKindTotals(userId, range),
    spentByCategory(userId, range.from, range.to),
    LedgerEntry.find({ userId: uid, date: { $gte: range.from, $lte: range.to } }).sort({ date: 1, _id: 1 }).limit(MAX_TX_ROWS + 1),
    Income.find({ userId, date: { $gte: range.from, $lte: range.to } }).sort({ date: 1, _id: 1 }),
    Expense.find({ userId, date: { $gte: range.from, $lte: range.to } }).sort({ date: 1, _id: 1 }),
    Fee.find(feeFilter).sort({ dueDate: 1 }),
    Loan.find({ userId }).sort({ date: 1 }),
    SavingsGoal.find({ userId }).sort({ createdAt: 1 }),
  ]);

  const opening = summarizeTotals(before).balancePaise;
  const movement = summarizeTotals(inRange);
  const net = movement.balancePaise;
  const totalCategory = categories.reduce((s, c) => s + c.totalPaise, 0);

  const fees = feeDocs.map((f) => feeView(f, now));
  const payments = await FeePayment.find({ userId, feeId: { $in: feeDocs.map((f) => f._id) } }).sort({ date: 1, _id: 1 });
  const feeTitle = new Map(feeDocs.map((f) => [String(f._id), f.title]));
  const loans = loanDocs.map((l) => loanView(l, now));

  // Budgets for every month the report touches (capped at 24).
  const budgets = [];
  const cursor = new Date(range.from.getTime() + 6 * 3600_000);
  for (let i = 0; i < 24 && cursor <= range.to; i++) {
    const m = currentMonthIST(cursor);
    const progress = await getBudgetProgress(userId, m);
    if (progress.hasBudget) budgets.push(progress);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
  }

  const title = {
    monthly: 'Monthly Financial Report', yearly: 'Yearly Financial Report', custom: 'Financial Report',
    expenses: 'Expense Report', income: 'Income Report', fees: 'Fees & Payments Report',
  }[p.type];

  const totalSavedPaise = goals.reduce((s, g) => s + g.savedPaise, 0);
  return {
    type: p.type,
    title,
    label: range.label,
    range: { from: range.from, to: range.to },
    generatedAt: now,
    user: { name: user.name, email: user.email, college: user.college ?? null, department: user.department, studentYear: user.studentYear, hostel: user.hostel ?? null },
    summary: {
      openingPaise: opening,
      incomePaise: movement.totalIncomePaise,
      expensesPaise: movement.totalExpensesPaise,
      closingPaise: opening + net,
      lentOutstandingPaise: summarizeTotals(mergeTotals(before, inRange)).lentOutstandingPaise,
      borrowedOutstandingPaise: summarizeTotals(mergeTotals(before, inRange)).borrowedOutstandingPaise,
      savedPaise: totalSavedPaise,
    },
    categorySpending: categories.map((c) => ({ ...c, percent: totalCategory ? Math.round((c.totalPaise * 1000) / totalCategory) / 10 : 0 })),
    incomeBySource: Object.entries(
      incomeDocs.reduce<Record<string, number>>((acc, i) => ((acc[i.source] = (acc[i.source] ?? 0) + i.amountPaise), acc), {}),
    ).map(([source, totalPaise]) => ({ source, label: INCOME_SOURCE_LABELS[source as keyof typeof INCOME_SOURCE_LABELS], totalPaise })),
    transactions: ledger.slice(0, MAX_TX_ROWS).map((e) => {
      const signed = signedAmount(e.kind, e.amountPaise);
      return { date: e.date, kind: e.kind, title: e.title, category: e.category ?? '', inPaise: signed > 0 ? signed : 0, outPaise: signed < 0 ? -signed : 0 };
    }),
    transactionsTruncated: ledger.length > MAX_TX_ROWS,
    incomeRows: incomeDocs.map((i) => ({ date: i.date, source: INCOME_SOURCE_LABELS[i.source], description: i.description ?? '', paymentMethod: i.paymentMethod ?? '', notes: i.notes ?? '', amountPaise: i.amountPaise })),
    expenseRows: expenseDocs.map((e) => ({ date: e.date, title: e.title, category: e.category, paymentMethod: e.paymentMethod ?? '', description: e.description ?? '', notes: e.notes ?? '', amountPaise: e.amountPaise })),
    fees: fees.map((f) => ({ title: f.title, category: f.category, academicYear: f.academicYear, dueDate: f.dueDate, totalPaise: f.totalPaise, paidPaise: f.paidPaise, remainingPaise: f.remainingPaise, status: f.status, notes: f.notes ?? '' })),
    feePayments: payments.map((x) => ({ date: x.date, feeTitle: feeTitle.get(String(x.feeId)) ?? '', amountPaise: x.amountPaise, referenceNo: x.referenceNo ?? '', notes: x.notes ?? '' })),
    upcoming: {
      fees: fees.filter((f) => f.status !== 'paid').map((f) => ({ title: f.title, dueDate: f.dueDate, remainingPaise: f.remainingPaise, status: f.status })),
      repayments: loans.filter((l) => l.status !== 'settled' && l.expectedDate).map((l) => ({ person: l.person, direction: l.direction, expectedDate: l.expectedDate!, remainingPaise: l.remainingPaise, status: l.status })),
    },
    lent: loans.filter((l) => l.direction === 'lent').map(loanRow),
    borrowed: loans.filter((l) => l.direction === 'borrowed').map(loanRow),
    budgets,
    savings: goals.map((g) => ({ name: g.name, targetPaise: g.targetPaise, savedPaise: g.savedPaise, targetDate: g.targetDate ?? null, description: g.description ?? '' })),
  };
}

function mergeTotals(a: Partial<Record<LedgerKind, number>>, b: Partial<Record<LedgerKind, number>>) {
  const out: Partial<Record<LedgerKind, number>> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k as LedgerKind] = (out[k as LedgerKind] ?? 0) + v;
  return out;
}

const loanRow = (l: ReturnType<typeof loanView>) => ({
  person: l.person, date: l.date, expectedDate: l.expectedDate ?? null, amountPaise: l.amountPaise, repaidPaise: l.repaidPaise, remainingPaise: l.remainingPaise, status: l.status, notes: l.notes ?? '',
});

export type Report = Awaited<ReturnType<typeof buildReport>>;
