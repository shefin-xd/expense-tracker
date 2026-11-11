import { addDays, addMonths, daysBetween, monthLabel, todayIST } from '@/lib/dates';

export interface Bar { key: string; label: string; totalPaise: number }

/**
 * Turns sparse per-day totals into a gap-free series for the chart.
 * Ranges up to ~3 months show one bar per day; longer ranges are grouped by month.
 * Days after `today` are left out, since nothing has been spent yet.
 */
export function buildSeries(points: { date: string; totalPaise: number }[], from: string, to: string, today = todayIST()): Bar[] {
  const end = to > today ? today : to;
  if (end < from) return [];
  const byDay = new Map(points.map((p) => [p.date, p.totalPaise]));

  if (daysBetween(from, end) <= 92) {
    const out: Bar[] = [];
    for (let d = from; d <= end; d = addDays(d, 1)) {
      const [, m, day] = d.split('-') as [string, string, string];
      out.push({ key: d, label: `${Number(day)}/${Number(m)}`, totalPaise: byDay.get(d) ?? 0 });
    }
    return out;
  }

  const sums = new Map<string, number>();
  for (const [d, v] of byDay) { const k = d.slice(0, 7); sums.set(k, (sums.get(k) ?? 0) + v); }
  const out: Bar[] = [];
  for (let m = from.slice(0, 7); m <= end.slice(0, 7); m = addMonths(m, 1)) {
    out.push({ key: m, label: monthLabel(m).slice(0, 3), totalPaise: sums.get(m) ?? 0 });
  }
  return out;
}

export interface Slice { name: string; value: number; percent: number }

/** Top categories plus an "Other" bucket; percentages are integers that always add up to 100. */
export function buildSlices(rows: { category: string; totalPaise: number }[], max = 6): Slice[] {
  const sorted = [...rows].filter((r) => r.totalPaise > 0).sort((a, b) => b.totalPaise - a.totalPaise);
  const head = sorted.slice(0, max).map((r) => ({ name: r.category, value: r.totalPaise }));
  const rest = sorted.slice(max).reduce((s, r) => s + r.totalPaise, 0);
  const items = rest > 0 ? [...head, { name: 'Other categories', value: rest }] : head;
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return [];
  // Largest-remainder rounding so the shown percentages sum to exactly 100.
  const raw = items.map((i) => ({ ...i, exact: (i.value * 100) / total }));
  const floors = raw.map((r) => Math.floor(r.exact));
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r.exact - floors[i]! })).sort((a, b) => b.frac - a.frac);
  for (const o of order) { if (left-- > 0) floors[o.i]!++; }
  return raw.map((r, i) => ({ name: r.name, value: r.value, percent: floors[i]! }));
}
