import { Types } from 'mongoose';
import type { FEE_CATEGORIES } from '../models/constants';
import { Fee, FeePayment } from '../models/Fee';
import { badRequest, notFound } from '../utils/errors';
import { pageMeta } from '../utils/http';
import { formatINR } from '../utils/money';
import { withTransaction } from '../utils/transaction';
import { recordEntry, removeEntries, syncEntry } from './ledger.service';
import { feeStatus, type FeeStatus } from './status.rules';

type FeeInput = {
  title: string; category: (typeof FEE_CATEGORIES)[number]; academicYear: string; totalPaise: number; dueDate: Date; notes?: string | undefined;
};

type FeeDoc = InstanceType<typeof Fee>;
export const feeView = (f: FeeDoc, now = new Date()) => ({
  ...f.toJSON(),
  remainingPaise: Math.max(0, f.totalPaise - f.paidPaise),
  status: feeStatus(f, now),
});

export async function createFee(userId: string, input: FeeInput) {
  return feeView(await Fee.create({ ...input, userId: new Types.ObjectId(userId) }));
}

export async function updateFee(userId: string, id: string, patch: Partial<FeeInput>) {
  // A fee can never be reduced below what has already been paid.
  const cond: Record<string, unknown> = { _id: id, userId };
  if (patch.totalPaise !== undefined) cond.paidPaise = { $lte: patch.totalPaise };
  const fee = await Fee.findOneAndUpdate(cond, { $set: patch }, { returnDocument: 'after' });
  if (!fee) {
    if (!(await Fee.exists({ _id: id, userId }))) throw notFound('Fee not found');
    throw badRequest('Total cannot be lower than the amount already paid');
  }
  if (patch.title) await renameFeePaymentTitles(userId, id, patch.title);
  return feeView(fee);
}

export async function deleteFee(userId: string, id: string) {
  await withTransaction(async (session) => {
    const fee = await Fee.findOne({ _id: id, userId }).session(session);
    if (!fee) throw notFound('Fee not found');
    const payments = await FeePayment.find({ userId, feeId: id }).session(session);
    await removeEntries(userId, 'feePayment', payments.map((p) => String(p._id)), session);
    await FeePayment.deleteMany({ userId, feeId: id }, { session });
    await fee.deleteOne({ session });
  });
}

export async function getFee(userId: string, id: string) {
  const fee = await Fee.findOne({ _id: id, userId });
  if (!fee) throw notFound('Fee not found');
  const payments = await FeePayment.find({ userId, feeId: id }).sort({ date: -1, _id: -1 });
  return { ...feeView(fee), payments };
}

export async function listFees(userId: string, q: { page: number; limit: number; academicYear?: string | undefined; status?: FeeStatus | undefined }) {
  const filter: Record<string, unknown> = { userId };
  if (q.academicYear) filter.academicYear = q.academicYear;
  // A student has few fees, so status (a derived value) is filtered in memory.
  const all = (await Fee.find(filter).sort({ dueDate: 1 })).map((f) => feeView(f));
  const filtered = q.status ? all.filter((f) => f.status === q.status) : all;
  const items = filtered.slice((q.page - 1) * q.limit, q.page * q.limit);
  return { items, meta: pageMeta(q.page, q.limit, filtered.length) };
}

export async function addPayment(userId: string, feeId: string, input: { amountPaise: number; date?: Date | undefined; referenceNo?: string | undefined; notes?: string | undefined }) {
  return withTransaction(async (session) => {
    // Atomic guard: the increment only applies if it keeps paid <= total. Two simultaneous
    // payments cannot both succeed and overpay the fee.
    const fee = await Fee.findOneAndUpdate(
      { _id: feeId, userId, $expr: { $lte: [{ $add: ['$paidPaise', input.amountPaise] }, '$totalPaise'] } },
      { $inc: { paidPaise: input.amountPaise } },
      { returnDocument: 'after', session },
    );
    if (!fee) {
      const existing = await Fee.findOne({ _id: feeId, userId }).session(session);
      if (!existing) throw notFound('Fee not found');
      throw badRequest(`Payment exceeds the remaining balance of ${formatINR(existing.totalPaise - existing.paidPaise)}`);
    }
    const date = input.date ?? new Date();
    const [payment] = await FeePayment.create(
      [{ userId: new Types.ObjectId(userId), feeId: fee._id, amountPaise: input.amountPaise, date, referenceNo: input.referenceNo, notes: input.notes }],
      { session },
    );
    await recordEntry(
      { userId, kind: 'fee_payment', amountPaise: input.amountPaise, date, title: `${fee.title} payment`.slice(0, 150), category: 'Fees', sourceType: 'feePayment', sourceId: String(payment!._id) },
      session,
    );
    return { fee: feeView(fee), payment: payment! };
  });
}

export async function completeFee(userId: string, feeId: string, input: { date?: Date | undefined; referenceNo?: string | undefined }) {
  const fee = await Fee.findOne({ _id: feeId, userId });
  if (!fee) throw notFound('Fee not found');
  const remaining = fee.totalPaise - fee.paidPaise;
  if (remaining <= 0) throw badRequest('This fee is already fully paid');
  return addPayment(userId, feeId, { amountPaise: remaining, ...input });
}

export async function deletePayment(userId: string, feeId: string, paymentId: string) {
  return withTransaction(async (session) => {
    const payment = await FeePayment.findOneAndDelete({ _id: paymentId, userId, feeId }, { session });
    if (!payment) throw notFound('Payment not found');
    const fee = await Fee.findOneAndUpdate({ _id: feeId, userId }, { $inc: { paidPaise: -payment.amountPaise } }, { returnDocument: 'after', session });
    await removeEntries(userId, 'feePayment', [paymentId], session);
    return feeView(fee!);
  });
}

/** Keeps the ledger title in sync if a fee is renamed. */
export async function renameFeePaymentTitles(userId: string, feeId: string, title: string) {
  const payments = await FeePayment.find({ userId, feeId });
  for (const p of payments) await syncEntry(userId, 'feePayment', String(p._id), { title: `${title} payment`.slice(0, 150) });
}
