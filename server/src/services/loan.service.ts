import { Types } from 'mongoose';
import { Loan } from '../models/Loan';
import { badRequest, notFound } from '../utils/errors';
import { escapeRegex, pageMeta } from '../utils/http';
import { formatINR } from '../utils/money';
import { withTransaction } from '../utils/transaction';
import type { LedgerKind } from './ledger.rules';
import { recordEntry, removeEntries, syncEntry } from './ledger.service';
import { loanStatus, type LoanStatus } from './status.rules';

export type Direction = 'lent' | 'borrowed';
type LoanInput = { person: string; amountPaise: number; date: Date; expectedDate?: Date | undefined; notes?: string | undefined };

const KIND: Record<Direction, { out: LedgerKind; repay: LedgerKind }> = {
  lent: { out: 'lend_out', repay: 'lend_repayment' },
  borrowed: { out: 'borrow_in', repay: 'borrow_repayment' },
};
const loanTitle = (d: Direction, person: string) => (d === 'lent' ? `Lent to ${person}` : `Borrowed from ${person}`).slice(0, 150);
const repayTitle = (d: Direction, person: string) => (d === 'lent' ? `${person} paid back` : `Repaid ${person}`).slice(0, 150);
const category = (d: Direction) => (d === 'lent' ? 'Lending' : 'Borrowing');

type LoanDoc = InstanceType<typeof Loan>;
export const loanView = (l: LoanDoc, now = new Date()) => ({
  ...l.toJSON(),
  remainingPaise: Math.max(0, l.amountPaise - l.repaidPaise),
  status: loanStatus(l, now),
});

export async function createLoan(userId: string, direction: Direction, input: LoanInput) {
  return withTransaction(async (session) => {
    const [loan] = await Loan.create([{ ...input, direction, userId: new Types.ObjectId(userId) }], { session });
    await recordEntry(
      { userId, kind: KIND[direction].out, amountPaise: input.amountPaise, date: input.date, title: loanTitle(direction, input.person), category: category(direction), sourceType: 'loan', sourceId: String(loan!._id) },
      session,
    );
    return loanView(loan!);
  });
}

export async function updateLoan(userId: string, direction: Direction, id: string, patch: Partial<LoanInput>) {
  return withTransaction(async (session) => {
    const cond: Record<string, unknown> = { _id: id, userId, direction };
    if (patch.amountPaise !== undefined) cond.repaidPaise = { $lte: patch.amountPaise };
    const loan = await Loan.findOneAndUpdate(cond, { $set: patch }, { returnDocument: 'after', session });
    if (!loan) {
      if (!(await Loan.exists({ _id: id, userId, direction }).session(session))) throw notFound('Record not found');
      throw badRequest('Amount cannot be lower than what has already been settled');
    }
    await syncEntry(userId, 'loan', id, { amountPaise: loan.amountPaise, date: loan.date, title: loanTitle(direction, loan.person) }, session);
    if (patch.person) for (const r of loan.repayments) await syncEntry(userId, 'loanRepayment', String(r._id), { title: repayTitle(direction, loan.person) }, session);
    return loanView(loan);
  });
}

export async function deleteLoan(userId: string, direction: Direction, id: string) {
  await withTransaction(async (session) => {
    const loan = await Loan.findOneAndDelete({ _id: id, userId, direction }, { session });
    if (!loan) throw notFound('Record not found');
    await removeEntries(userId, 'loan', [id], session);
    await removeEntries(userId, 'loanRepayment', loan.repayments.map((r) => String(r._id)), session);
  });
}

export async function getLoan(userId: string, direction: Direction, id: string) {
  const loan = await Loan.findOne({ _id: id, userId, direction });
  if (!loan) throw notFound('Record not found');
  return loanView(loan);
}

export async function listLoans(userId: string, direction: Direction, q: { page: number; limit: number; status?: LoanStatus | undefined; search?: string | undefined }) {
  const filter: Record<string, unknown> = { userId, direction };
  if (q.search) filter.person = new RegExp(escapeRegex(q.search), 'i');
  const all = (await Loan.find(filter).sort({ date: -1, _id: -1 })).map((l) => loanView(l));
  const filtered = q.status ? all.filter((l) => l.status === q.status) : all;
  return { items: filtered.slice((q.page - 1) * q.limit, q.page * q.limit), meta: pageMeta(q.page, q.limit, filtered.length) };
}

export async function loanTotals(userId: string, direction: Direction) {
  const [row] = await Loan.aggregate<{ total: number; repaid: number }>([
    { $match: { userId: new Types.ObjectId(userId), direction } },
    { $group: { _id: null, total: { $sum: '$amountPaise' }, repaid: { $sum: '$repaidPaise' } } },
  ]);
  const total = row?.total ?? 0;
  const repaid = row?.repaid ?? 0;
  return { totalPaise: total, repaidPaise: repaid, outstandingPaise: total - repaid };
}

export async function addRepayment(userId: string, direction: Direction, id: string, input: { amountPaise: number; date?: Date | undefined; notes?: string | undefined }) {
  return withTransaction(async (session) => {
    const repId = new Types.ObjectId();
    const date = input.date ?? new Date();
    const loan = await Loan.findOneAndUpdate(
      { _id: id, userId, direction, $expr: { $lte: [{ $add: ['$repaidPaise', input.amountPaise] }, '$amountPaise'] } },
      { $inc: { repaidPaise: input.amountPaise }, $push: { repayments: { _id: repId, amountPaise: input.amountPaise, date, notes: input.notes } } },
      { returnDocument: 'after', session },
    );
    if (!loan) {
      const existing = await Loan.findOne({ _id: id, userId, direction }).session(session);
      if (!existing) throw notFound('Record not found');
      throw badRequest(`Amount exceeds the remaining ${formatINR(existing.amountPaise - existing.repaidPaise)}`);
    }
    await recordEntry(
      { userId, kind: KIND[direction].repay, amountPaise: input.amountPaise, date, title: repayTitle(direction, loan.person), category: category(direction), sourceType: 'loanRepayment', sourceId: String(repId) },
      session,
    );
    return loanView(loan);
  });
}

export async function deleteRepayment(userId: string, direction: Direction, id: string, repaymentId: string) {
  return withTransaction(async (session) => {
    const loan = await Loan.findOne({ _id: id, userId, direction }).session(session);
    const rep = loan?.repayments.find((r) => String(r._id) === repaymentId);
    if (!loan || !rep) throw notFound('Repayment not found');
    const updated = await Loan.findOneAndUpdate(
      { _id: id, userId },
      { $inc: { repaidPaise: -rep.amountPaise }, $pull: { repayments: { _id: rep._id } } },
      { returnDocument: 'after', session },
    );
    await removeEntries(userId, 'loanRepayment', [repaymentId], session);
    return loanView(updated!);
  });
}
