import { addDays, addMonths, lastDayOfMonth, todayIST, weekStart } from '@/lib/dates';

export type Preset = 'week' | 'month' | 'last_month' | 'three_months' | 'year' | 'custom';
export const PRESETS: { value: Preset; label: string }[] = [
  { value: 'week', label: 'This week' }, { value: 'month', label: 'This month' }, { value: 'last_month', label: 'Last month' },
  { value: 'three_months', label: 'Last 3 months' }, { value: 'year', label: 'This year' }, { value: 'custom', label: 'Custom' },
];

/** Inclusive IST day range for a preset. */
export function presetRange(p: Exclude<Preset, 'custom'>, today = todayIST()): { from: string; to: string } {
  const month = today.slice(0, 7);
  switch (p) {
    case 'week': return { from: weekStart(today), to: addDays(weekStart(today), 6) };
    case 'month': return { from: `${month}-01`, to: lastDayOfMonth(month) };
    case 'last_month': { const m = addMonths(month, -1); return { from: `${m}-01`, to: lastDayOfMonth(m) }; }
    case 'three_months': return { from: `${addMonths(month, -2)}-01`, to: lastDayOfMonth(month) };
    case 'year': return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  }
}
export const defaultCustom = () => ({ from: addDays(todayIST(), -29), to: todayIST() });
