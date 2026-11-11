import { Types } from 'mongoose';
import { LedgerEntry } from '../models/LedgerEntry';
import { escapeRegex, pageMeta } from '../utils/http';
import { EXPENSE_KINDS, INCOME_KINDS, LEDGER_KINDS, type LedgerKind } from './ledger.rules';

export interface TransactionQuery {
  page: number; limit: number;
  type?: 'income' | 'expense' | undefined;
  kind?: LedgerKind | undefined;
  category?: string | undefined;
  search?: string | undefined;
  from?: Date | undefined; to?: Date | undefined;
  sortBy: 'date' | 'amount'; order: 'asc' | 'desc';
}

/** Unified history: every ledger entry (income, expenses, fee payments, loans, repayments). */
export async function listTransactions(userId: string, q: TransactionQuery) {
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (q.kind) filter.kind = q.kind;
  else if (q.type) filter.kind = { $in: q.type === 'income' ? INCOME_KINDS : EXPENSE_KINDS };
  if (q.category) filter.category = q.category;
  if (q.search) filter.title = new RegExp(escapeRegex(q.search), 'i');
  if (q.from || q.to) filter.date = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  const dir = q.order === 'asc' ? 1 : -1;
  const [items, total] = await Promise.all([
    LedgerEntry.find(filter).sort({ [q.sortBy === 'amount' ? 'amountPaise' : 'date']: dir, _id: dir }).skip((q.page - 1) * q.limit).limit(q.limit),
    LedgerEntry.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(q.page, q.limit, total) };
}

export { LEDGER_KINDS };
