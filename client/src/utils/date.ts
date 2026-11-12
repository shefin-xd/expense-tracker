/** Everything is shown and chosen in Asia/Kolkata (UTC+05:30, no DST). */
const IST_MS = 330 * 60 * 1000;
const istShift = (d: Date) => new Date(d.getTime() + IST_MS);

export type DateFormatPref = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

/** "2026-11-06" in IST for a given instant. */
export const toDayKey = (d: Date | string): string => istShift(new Date(d)).toISOString().slice(0, 10);
export const todayKey = () => toDayKey(new Date());
export const currentMonthKey = () => todayKey().slice(0, 7);

export function formatDate(d: Date | string | null | undefined, pref: DateFormatPref = 'DD/MM/YYYY'): string {
  if (!d) return '';
  const [y, m, day] = toDayKey(d).split('-') as [string, string, string];
  return pref === 'MM/DD/YYYY' ? `${m}/${day}/${y}` : pref === 'YYYY-MM-DD' ? `${y}-${m}-${day}` : `${day}/${m}/${y}`;
}

export function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const dayStart = (day: string) => new Date(new Date(`${day}T00:00:00.000Z`).getTime() - IST_MS);
export const dayEnd = (day: string) => new Date(dayStart(day).getTime() + 24 * 3600_000 - 1);

export function addDays(day: string, n: number): string {
  return new Date(new Date(`${day}T00:00:00.000Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

export function relativeDue(d: Date | string): string {
  const days = Math.round((dayStart(toDayKey(d)).getTime() - dayStart(todayKey()).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}
