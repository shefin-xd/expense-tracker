import { dayKeyIST } from '../utils/dates';

const pad = (n: number) => String(n).padStart(2, '0');
export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
}

export interface RecurringLike { active: boolean; startMonth: string; lastHandledMonth?: string | null | undefined; dayOfMonth: number }

/**
 * Pure rules (Asia/Kolkata). An item is "due" once its day of the month has arrived and this month has not yet been
 * confirmed or skipped. Earlier months that were never handled are not backfilled; only the current month matters.
 */
export function recurringState(r: RecurringLike, now = new Date()) {
  const today = dayKeyIST(now);
  const month = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const started = r.startMonth <= month;
  const handled = r.lastHandledMonth === month;
  const due = r.active && started && !handled && day >= r.dayOfMonth;
  const nextMonthKey = !started ? r.startMonth : handled ? nextMonth(month) : month;
  return { due, month, nextDueDate: `${nextMonthKey}-${pad(r.dayOfMonth)}` };
}
