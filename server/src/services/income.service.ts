import { Types } from 'mongoose';
import { INCOME_SOURCE_LABELS, PARENT_SOURCES, type INCOME_SOURCES, type PAYMENT_METHODS } from '../models/constants';
import { Income } from '../models/Income';
import { currentMonthIST, currentYearIST, monthRangeIST, yearRangeIST } from '../utils/dates';
import { notFound } from '../utils/errors';
import { escapeRegex, pageMeta } from '../utils/http';
import { withTransaction } from '../utils/transaction';
import { recordEntry, removeEntries, syncEntry } from './ledger.service';

type Source = (typeof INCOME_SOURCES)[number];
type IncomeInput = {
  source: Source; amountPaise: number; date: Date; paymentMethod: (typeof PAYMENT_METHODS)[number];
  description?: string | undefined; notes?: string | undefined;
};

const titleOf = (source: Source, description?: string | null) =>
  (description ? `${INCOME_SOURCE_LABELS[source]}: ${description}` : INCOME_SOURCE_LABELS[source]).slice(0, 150);

export async function createIncome(userId: string, input: IncomeInput) {
  return withTransaction(async (session) => {
    const [inc] = await Income.create([{ ...input, userId: new Types.ObjectId(userId) }], { session });
    await recordEntry(
      { userId, kind: 'income', amountPaise: input.amountPaise, date: input.date, title: titleOf(input.source, input.description), category: input.source, sourceType: 'income', sourceId: String(inc!._id) },
      session,
    );
    return inc!;
  });
}

export async function updateIncome(userId: string, id: string, patch: Partial<IncomeInput>) {
  return withTransaction(async (session) => {
    const inc = await Income.findOneAndUpdate({ _id: id, userId }, { $set: patch }, { returnDocument: 'after', session });
    if (!inc) throw notFound('Income record not found');
    await syncEntry(userId, 'income', id, { amountPaise: inc.amountPaise, date: inc.date, title: titleOf(inc.source, inc.description), category: inc.source }, session);
    return inc;
  });
}

export async function deleteIncome(userId: string, id: string) {
  await withTransaction(async (session) => {
    const res = await Income.deleteOne({ _id: id, userId }, { session });
    if (res.deletedCount === 0) throw notFound('Income record not found');
    await removeEntries(userId, 'income', [id], session);
  });
}

export async function getIncome(userId: string, id: string) {
  const inc = await Income.findOne({ _id: id, userId });
  if (!inc) throw notFound('Income record not found');
  return inc;
}

export async function listIncome(
  userId: string,
  q: { page: number; limit: number; from?: Date | undefined; to?: Date | undefined; source?: Source | undefined; search?: string | undefined; sortBy: 'date' | 'amount'; order: 'asc' | 'desc' },
) {
  const filter: Record<string, unknown> = { userId };
  if (q.source) filter.source = q.source;
  if (q.from || q.to) filter.date = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ description: rx }, { notes: rx }];
  }
  const dir = q.order === 'asc' ? 1 : -1;
  const [items, total] = await Promise.all([
    Income.find(filter).sort({ [q.sortBy === 'amount' ? 'amountPaise' : 'date']: dir, _id: dir }).skip((q.page - 1) * q.limit).limit(q.limit),
    Income.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(q.page, q.limit, total) };
}

/** Money from parents (parents + monthly pocket money), with month/year breakdown. */
export async function parentAllowanceSummary(userId: string, now = new Date()) {
  const base = { userId: new Types.ObjectId(userId), source: { $in: [...PARENT_SOURCES] } };
  const sum = async (range?: { from: Date; to: Date }) => {
    const [row] = await Income.aggregate<{ total: number }>([
      { $match: { ...base, ...(range ? { date: { $gte: range.from, $lte: range.to } } : {}) } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]);
    return row?.total ?? 0;
  };
  const [totalPaise, thisMonthPaise, thisYearPaise, history] = await Promise.all([
    sum(),
    sum(monthRangeIST(currentMonthIST(now))),
    sum(yearRangeIST(currentYearIST(now))),
    Income.find(base).sort({ date: -1, _id: -1 }).limit(50),
  ]);
  return { totalPaise, thisMonthPaise, thisYearPaise, lastReceivedDate: history[0]?.date ?? null, history };
}
