import { Types } from 'mongoose';
import type { INCOME_SOURCES, PAYMENT_METHODS } from '../models/constants';
import { Recurring } from '../models/Recurring';
import { currentMonthIST } from '../utils/dates';
import { badRequest, conflict, notFound } from '../utils/errors';
import { assertCategoryAllowed } from './category.service';
import { createExpense } from './expense.service';
import { createIncome } from './income.service';
import { recurringState } from './recurring.rules';

type Input = {
  kind: 'income' | 'expense'; name: string; amountPaise: number; dayOfMonth: number; source?: (typeof INCOME_SOURCES)[number] | undefined;
  category?: string | undefined; paymentMethod: (typeof PAYMENT_METHODS)[number]; notes?: string | undefined; active: boolean; startMonth?: string | undefined;
};
type Doc = InstanceType<typeof Recurring>;

export const recurringView = (r: Doc, now = new Date()) => ({ ...r.toJSON(), ...recurringState(r, now) });

export async function createRecurring(userId: string, input: Input) {
  if (input.kind === 'expense' && input.category) await assertCategoryAllowed(userId, input.category);
  const { source, category, ...rest } = input;
  const doc = await Recurring.create({
    ...rest, userId: new Types.ObjectId(userId), startMonth: input.startMonth ?? currentMonthIST(),
    ...(input.kind === 'income' ? { source } : { category }),
  });
  return recurringView(doc);
}

export async function listRecurring(userId: string) {
  const docs = await Recurring.find({ userId }).sort({ dayOfMonth: 1, name: 1 });
  const items = docs.map((d) => recurringView(d));
  return { items, dueCount: items.filter((i) => i.due).length };
}

export async function updateRecurring(userId: string, id: string, patch: Partial<Input>) {
  if (patch.category) await assertCategoryAllowed(userId, patch.category);
  const doc = await Recurring.findOneAndUpdate({ _id: id, userId }, { $set: patch }, { returnDocument: 'after' });
  if (!doc) throw notFound('Recurring item not found');
  return recurringView(doc);
}

export async function deleteRecurring(userId: string, id: string) {
  if ((await Recurring.deleteOne({ _id: id, userId })).deletedCount === 0) throw notFound('Recurring item not found');
}

/** Marks this month handled in one atomic step, so confirming twice (two tabs, a retry) can only succeed once. */
async function claimMonth(userId: string, id: string) {
  const month = currentMonthIST();
  const claimed = await Recurring.findOneAndUpdate(
    { _id: id, userId, active: true, lastHandledMonth: { $ne: month } },
    { $set: { lastHandledMonth: month } },
    { returnDocument: 'before' },
  );
  if (!claimed) {
    const existing = await Recurring.findOne({ _id: id, userId });
    if (!existing) throw notFound('Recurring item not found');
    if (!existing.active) throw badRequest('This item is paused');
    throw conflict('This month is already confirmed or skipped');
  }
  return { claimed, month };
}

export async function confirmRecurring(userId: string, id: string, over: { amountPaise?: number; date?: Date }) {
  const { claimed } = await claimMonth(userId, id);
  const state = recurringState(claimed);
  if (!state.due) { // not yet due this month: undo the claim, nothing recorded
    await Recurring.updateOne({ _id: id, userId }, { $set: { lastHandledMonth: claimed.lastHandledMonth ?? null } });
    throw badRequest(`Not due yet. It is due on ${state.nextDueDate}.`);
  }
  const amountPaise = over.amountPaise ?? claimed.amountPaise;
  const date = over.date ?? new Date();
  try {
    const created = claimed.kind === 'income'
      ? await createIncome(userId, { source: claimed.source!, amountPaise, date, paymentMethod: claimed.paymentMethod ?? 'upi', description: claimed.name, notes: claimed.notes ?? undefined })
      : await createExpense(userId, { title: claimed.name, amountPaise, category: claimed.category!, date, paymentMethod: claimed.paymentMethod ?? 'upi', description: 'Recurring', notes: claimed.notes ?? undefined });
    const doc = await Recurring.findById(id);
    return { recurring: recurringView(doc!), created };
  } catch (e) {
    await Recurring.updateOne({ _id: id, userId }, { $set: { lastHandledMonth: claimed.lastHandledMonth ?? null } }); // nothing was recorded, so let the user try again
    throw e;
  }
}

export async function skipRecurring(userId: string, id: string) {
  const { claimed } = await claimMonth(userId, id);
  if (!recurringState(claimed).due) {
    await Recurring.updateOne({ _id: id, userId }, { $set: { lastHandledMonth: claimed.lastHandledMonth ?? null } });
    throw badRequest(`Not due yet. It is due on ${recurringState(claimed).nextDueDate}.`);
  }
  return recurringView((await Recurring.findById(id))!);
}
