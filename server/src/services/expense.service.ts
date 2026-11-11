import { Types } from 'mongoose';
import type { PAYMENT_METHODS } from '../models/constants';
import { Expense } from '../models/Expense';
import { escapeRegex, pageMeta } from '../utils/http';
import { notFound } from '../utils/errors';
import { withTransaction } from '../utils/transaction';
import { assertCategoryAllowed } from './category.service';
import { recordEntry, removeEntries, syncEntry } from './ledger.service';

type ExpenseInput = {
  title: string; amountPaise: number; category: string; date: Date; paymentMethod: (typeof PAYMENT_METHODS)[number];
  description?: string | undefined; notes?: string | undefined; receiptUrl?: string | undefined;
};

export async function createExpense(userId: string, input: ExpenseInput) {
  await assertCategoryAllowed(userId, input.category);
  return withTransaction(async (session) => {
    const [exp] = await Expense.create([{ ...input, userId: new Types.ObjectId(userId) }], { session });
    await recordEntry(
      { userId, kind: 'expense', amountPaise: input.amountPaise, date: input.date, title: input.title, category: input.category, sourceType: 'expense', sourceId: String(exp!._id) },
      session,
    );
    return exp!;
  });
}

export async function updateExpense(userId: string, id: string, patch: Partial<ExpenseInput>) {
  if (patch.category) await assertCategoryAllowed(userId, patch.category);
  return withTransaction(async (session) => {
    const exp = await Expense.findOneAndUpdate({ _id: id, userId }, { $set: patch }, { returnDocument: 'after', session });
    if (!exp) throw notFound('Expense not found');
    await syncEntry(userId, 'expense', id, { amountPaise: exp.amountPaise, date: exp.date, title: exp.title, category: exp.category }, session);
    return exp;
  });
}

export async function deleteExpense(userId: string, id: string) {
  await withTransaction(async (session) => {
    const res = await Expense.deleteOne({ _id: id, userId }, { session });
    if (res.deletedCount === 0) throw notFound('Expense not found');
    await removeEntries(userId, 'expense', [id], session);
  });
}

export async function getExpense(userId: string, id: string) {
  const exp = await Expense.findOne({ _id: id, userId });
  if (!exp) throw notFound('Expense not found');
  return exp;
}

export async function listExpenses(
  userId: string,
  q: { page: number; limit: number; from?: Date | undefined; to?: Date | undefined; search?: string | undefined; category?: string | undefined; paymentMethod?: (typeof PAYMENT_METHODS)[number] | undefined; sortBy: 'date' | 'amount'; order: 'asc' | 'desc' },
) {
  const filter: Record<string, unknown> = { userId };
  if (q.category) filter.category = q.category;
  if (q.paymentMethod) filter.paymentMethod = q.paymentMethod;
  if (q.from || q.to) filter.date = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { notes: rx }];
  }
  const sortField = q.sortBy === 'amount' ? 'amountPaise' : 'date';
  const dir = q.order === 'asc' ? 1 : -1;
  const [items, total] = await Promise.all([
    Expense.find(filter).sort({ [sortField]: dir, _id: dir }).skip((q.page - 1) * q.limit).limit(q.limit),
    Expense.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(q.page, q.limit, total) };
}
