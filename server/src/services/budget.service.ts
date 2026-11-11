import { Types } from 'mongoose';
import { Budget } from '../models/Budget';
import { Expense } from '../models/Expense';
import { monthRangeIST } from '../utils/dates';
import { assertCategoryAllowed } from './category.service';
import { budgetLevel, percent } from './status.rules';

export async function upsertBudget(userId: string, month: string, input: { overallPaise?: number | undefined; categories: { category: string; limitPaise: number }[] }) {
  for (const c of input.categories) await assertCategoryAllowed(userId, c.category);
  const $set = { overallPaise: input.overallPaise, categories: input.categories };
  const $unset = input.overallPaise === undefined ? { overallPaise: '' } : {};
  await Budget.updateOne({ userId, month }, { $set: input.overallPaise === undefined ? { categories: input.categories } : $set, $unset }, { upsert: true });
  return getBudgetProgress(userId, month);
}

export async function spentByCategory(userId: string, from: Date, to: Date) {
  const rows = await Expense.aggregate<{ _id: string; total: number; count: number }>([
    { $match: { userId: new Types.ObjectId(userId), date: { $gte: from, $lte: to } } },
    { $group: { _id: '$category', total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  return rows.map((r) => ({ category: r._id, totalPaise: r.total, count: r.count }));
}

export async function getBudgetProgress(userId: string, month: string) {
  const { from, to } = monthRangeIST(month);
  const [budget, spent] = await Promise.all([Budget.findOne({ userId, month }), spentByCategory(userId, from, to)]);
  const totalSpent = spent.reduce((s, r) => s + r.totalPaise, 0);
  const spentOf = (c: string) => spent.find((r) => r.category === c)?.totalPaise ?? 0;

  const overall = budget?.overallPaise
    ? { limitPaise: budget.overallPaise, spentPaise: totalSpent, remainingPaise: budget.overallPaise - totalSpent, percentUsed: percent(totalSpent, budget.overallPaise), level: budgetLevel(totalSpent, budget.overallPaise) }
    : null;
  const categories = (budget?.categories ?? []).map((c) => {
    const s = spentOf(c.category);
    return { category: c.category, limitPaise: c.limitPaise, spentPaise: s, remainingPaise: c.limitPaise - s, percentUsed: percent(s, c.limitPaise), level: budgetLevel(s, c.limitPaise) };
  });
  return { month, hasBudget: !!budget, overall, categories, spentPaise: totalSpent, spendingByCategory: spent };
}

export async function compareMonths(userId: string, month: string) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const [a, b] = await Promise.all([getBudgetProgress(userId, month), getBudgetProgress(userId, prev)]);
  return { month, previousMonth: prev, spentPaise: a.spentPaise, previousSpentPaise: b.spentPaise, changePaise: a.spentPaise - b.spentPaise };
}
