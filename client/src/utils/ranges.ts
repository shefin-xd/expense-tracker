import { addDays, dayEnd, dayStart, todayKey } from './date';

export const RANGE_OPTIONS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'three_months', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
] as const;
export type RangeKey = (typeof RANGE_OPTIONS)[number]['value'];

const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Inclusive IST day range [from, to] as "YYYY-MM-DD" strings. */
export function rangeDays(key: Exclude<RangeKey, 'custom'>, today = todayKey()): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (key) {
    case 'week': {
      const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
      const from = addDays(today, -((dow + 6) % 7)); // weeks start on Monday
      return { from, to: addDays(from, 6) };
    }
    case 'month':
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}` };
    case 'last_month': {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDayOfMonth(py, pm))}` };
    }
    case 'three_months': {
      const d = new Date(Date.UTC(y, m - 3, 1));
      return { from: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`, to: `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}` };
    }
    case 'year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

export function rangeToIso(r: { from: string; to: string }) {
  return { from: dayStart(r.from).toISOString(), to: dayEnd(r.to).toISOString() };
}

/** Every day in [from, to], for charts that should show quiet days as zero. */
export function eachDay(from: string, to: string, cap = 92): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < cap; d = addDays(d, 1)) out.push(d);
  return out;
}
