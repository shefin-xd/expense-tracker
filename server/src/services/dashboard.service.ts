import { Types } from 'mongoose';
import { Fee } from '../models/Fee';
import { LedgerEntry } from '../models/LedgerEntry';
import { Loan } from '../models/Loan';
import { SavingsGoal } from '../models/SavingsGoal';
import { dayKeyIST } from '../utils/dates';
import { spentByCategory } from './budget.service';
import { loanView } from './loan.service';
import { feeView } from './fee.service';
import { getSummary } from './ledger.service';

export async function getDashboard(userId: string, range: { from: Date; to: Date }, now = new Date()) {
  const uid = new Types.ObjectId(userId);
  const [allTime, inRange, spendRows, categories, recent, feeDocs, loanDocs, savings] = await Promise.all([
    getSummary(userId),
    getSummary(userId, range),
    LedgerEntry.find({ userId: uid, kind: { $in: ['expense', 'fee_payment'] }, date: { $gte: range.from, $lte: range.to } }).select('date amountPaise kind'),
    spentByCategory(userId, range.from, range.to),
    LedgerEntry.find({ userId: uid }).sort({ date: -1, _id: -1 }).limit(8),
    Fee.find({ userId }).sort({ dueDate: 1 }),
    Loan.find({ userId }),
    SavingsGoal.find({ userId }),
  ]);

  // Fee payments are spending too (they reduce your balance), so they appear as a "Fees" slice and the
  // category breakdown adds up to the same total as the spending chart.
  const feePaid = spendRows.filter((r) => r.kind === 'fee_payment');
  const feeTotal = feePaid.reduce((s, r) => s + r.amountPaise, 0);
  const breakdown = feeTotal
    ? [...categories, { category: 'Fees', totalPaise: feeTotal, count: feePaid.length }].sort((a, b) => b.totalPaise - a.totalPaise)
    : categories;

  const byDay = new Map<string, number>();
  for (const r of spendRows) byDay.set(dayKeyIST(r.date), (byDay.get(dayKeyIST(r.date)) ?? 0) + r.amountPaise);
  const spendingSeries = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, totalPaise]) => ({ date, totalPaise }));

  const upcomingFees = feeDocs.map((f) => feeView(f, now)).filter((f) => f.status !== 'paid').slice(0, 5);
  const upcomingRepayments = loanDocs.map((l) => loanView(l, now)).filter((l) => l.status !== 'settled' && l.expectedDate).sort((a, b) => +a.expectedDate! - +b.expectedDate!).slice(0, 5);

  return {
    balance: { currentPaise: allTime.balancePaise, lentOutstandingPaise: allTime.lentOutstandingPaise, borrowedOutstandingPaise: allTime.borrowedOutstandingPaise },
    range: { totalIncomePaise: inRange.totalIncomePaise, totalExpensesPaise: inRange.totalExpensesPaise },
    allTime: { totalIncomePaise: allTime.totalIncomePaise, totalExpensesPaise: allTime.totalExpensesPaise },
    totalSavingsPaise: savings.reduce((s, g) => s + g.savedPaise, 0),
    spendingSeries,
    categoryBreakdown: breakdown,
    recentTransactions: recent,
    upcoming: { fees: upcomingFees, repayments: upcomingRepayments },
  };
}
