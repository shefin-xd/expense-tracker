import { Types } from 'mongoose';
import { Fee } from '../models/Fee';
import { Loan } from '../models/Loan';
import { Notification, type NOTIFICATION_TYPES } from '../models/Notification';
import { User } from '../models/User';
import { currentMonthIST } from '../utils/dates';
import { notFound } from '../utils/errors';
import { formatINR } from '../utils/money';
import { getBudgetProgress } from './budget.service';
import { feeStatus, loanStatus } from './status.rules';

const DAY = 24 * 60 * 60 * 1000;
const SOON_DAYS = 7;
type Draft = { type: (typeof NOTIFICATION_TYPES)[number]; title: string; message: string; dedupeKey: string };

/** Creates notifications for conditions that are true right now. Each condition notifies once. */
export async function syncNotifications(userId: string, now = new Date()) {
  const user = await User.findById(userId);
  const prefs = user?.preferences?.notifications;
  const drafts: Draft[] = [];

  if (prefs?.feeDeadlines !== false) {
    for (const f of await Fee.find({ userId })) {
      const st = feeStatus(f, now);
      const remaining = formatINR(f.totalPaise - f.paidPaise);
      if (st === 'overdue') drafts.push({ type: 'fee_overdue', title: 'Fee overdue', message: `${f.title}: ${remaining} is past its due date.`, dedupeKey: `fee:${f._id}:overdue` });
      else if (st !== 'paid' && f.dueDate.getTime() - now.getTime() <= SOON_DAYS * DAY)
        drafts.push({ type: 'fee_due_soon', title: 'Fee due soon', message: `${f.title}: ${remaining} is due within ${SOON_DAYS} days.`, dedupeKey: `fee:${f._id}:soon` });
    }
  }

  if (prefs?.repayments !== false) {
    for (const l of await Loan.find({ userId, expectedDate: { $exists: true } })) {
      const st = loanStatus(l, now);
      if (st === 'settled' || !l.expectedDate) continue;
      const who = l.direction === 'lent' ? `${l.person} owes you` : `You owe ${l.person}`;
      const amt = formatINR(l.amountPaise - l.repaidPaise);
      if (st === 'overdue') drafts.push({ type: 'repayment_due', title: 'Repayment overdue', message: `${who} ${amt}. The expected date has passed.`, dedupeKey: `loan:${l._id}:overdue` });
      else if (l.expectedDate.getTime() - now.getTime() <= SOON_DAYS * DAY) drafts.push({ type: 'repayment_due', title: 'Repayment due soon', message: `${who} ${amt} within ${SOON_DAYS} days.`, dedupeKey: `loan:${l._id}:soon` });
    }
  }

  if (prefs?.budgetWarnings !== false) {
    const month = currentMonthIST(now);
    const p = await getBudgetProgress(userId, month);
    const items = [...(p.overall ? [{ name: 'Overall budget', ...p.overall }] : []), ...p.categories.map((c) => ({ name: `${c.category} budget`, ...c }))];
    for (const i of items) {
      if (i.level === 'ok') continue;
      drafts.push({
        type: 'budget_warning',
        title: i.level === 'over' ? 'Budget exceeded' : 'Budget almost used',
        message: `${i.name}: ${formatINR(i.spentPaise)} of ${formatINR(i.limitPaise)} used this month.`,
        dedupeKey: `budget:${month}:${i.name}:${i.level}`,
      });
    }
  }

  for (const d of drafts) await Notification.updateOne({ userId: new Types.ObjectId(userId), dedupeKey: d.dedupeKey }, { $setOnInsert: { ...d, userId: new Types.ObjectId(userId) } }, { upsert: true });
}

export async function notify(userId: string, d: Draft) {
  await Notification.updateOne({ userId: new Types.ObjectId(userId), dedupeKey: d.dedupeKey }, { $setOnInsert: { ...d, userId: new Types.ObjectId(userId) } }, { upsert: true });
}

export async function listNotifications(userId: string, unreadOnly = false) {
  await syncNotifications(userId);
  const filter = { userId, ...(unreadOnly ? { read: false } : {}) };
  const [items, unreadCount] = await Promise.all([Notification.find(filter).sort({ createdAt: -1 }).limit(100), Notification.countDocuments({ userId, read: false })]);
  return { items, unreadCount };
}

export async function markRead(userId: string, id: string) {
  const n = await Notification.findOneAndUpdate({ _id: id, userId }, { $set: { read: true } }, { returnDocument: 'after' });
  if (!n) throw notFound('Notification not found');
  return n;
}
export const markAllRead = (userId: string) => Notification.updateMany({ userId, read: false }, { $set: { read: true } });
export async function deleteNotification(userId: string, id: string) {
  if ((await Notification.deleteOne({ _id: id, userId })).deletedCount === 0) throw notFound('Notification not found');
}
