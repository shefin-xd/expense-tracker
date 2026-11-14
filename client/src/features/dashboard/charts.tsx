import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { eachDay } from '@/utils/ranges';
import { formatINR, formatINRShort } from '@/utils/money';

export interface Point { label: string; totalPaise: number }

/** Daily bars for up to ~3 months of data, monthly bars beyond that, with quiet days shown as zero. */
export function buildSeries(range: { from: string; to: string }, series: { date: string; totalPaise: number }[]): Point[] {
  const days = eachDay(range.from, range.to, 400);
  const byDay = new Map(series.map((s) => [s.date, s.totalPaise]));
  if (days.length <= 92) return days.map((d) => ({ label: d, totalPaise: byDay.get(d) ?? 0 }));
  const months = new Map<string, number>();
  for (const d of days) months.set(d.slice(0, 7), (months.get(d.slice(0, 7)) ?? 0) + (byDay.get(d) ?? 0));
  return [...months.entries()].map(([label, totalPaise]) => ({ label, totalPaise }));
}

const tick = (label: string) => (label.length === 7 ? new Date(`${label}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }) : label.slice(8).replace(/^0/, ''));
const longLabel = (label: string) => (label.length === 7 ? new Date(`${label}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : label.split('-').reverse().join('/'));

export function SpendingChart({ data }: { data: Point[] }) {
  const total = data.reduce((s, d) => s + d.totalPaise, 0);
  if (!total) return <p className="grid h-48 place-items-center text-sm text-muted">No spending in this period.</p>;
  const summary = `Spending chart, ${formatINR(total)} in total over ${data.length} ${data[0]?.label.length === 7 ? 'months' : 'days'}.`;
  return (
    <div role="img" aria-label={summary} className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="label" tickFormatter={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
          <YAxis tickFormatter={(v: number) => formatINRShort(v)} tickLine={false} axisLine={false} width={64} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
          <Tooltip cursor={{ fill: 'var(--surface)' }} contentStyle={{ background: 'var(--surface-solid)', border: 'none', borderRadius: 12, fontSize: 13, boxShadow: '0 8px 30px rgba(0,0,0,0.18)' }} labelStyle={{ color: 'var(--text)', fontWeight: 500 }} itemStyle={{ color: 'var(--text)' }}
            labelFormatter={(l) => longLabel(String(l))} formatter={(v) => [formatINR(Number(v)), 'Spent']} />
          <Bar dataKey="totalPaise" fill="var(--accent)" radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const PALETTE = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--purple)', 'var(--pink)', 'var(--teal)', 'var(--indigo)', 'var(--yellow)'];

export function CategoryBars({ items }: { items: { category: string; totalPaise: number }[] }) {
  const total = items.reduce((s, i) => s + i.totalPaise, 0);
  if (!total) return <p className="py-10 text-center text-sm text-muted">No expenses in this period.</p>;
  const top = items.slice(0, 7);
  const rest = items.slice(7).reduce((s, i) => s + i.totalPaise, 0);
  const rows = rest ? [...top, { category: 'Everything else', totalPaise: rest }] : top;
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => {
        const pct = Math.round((r.totalPaise * 100) / total);
        return (
          <li key={r.category}>
            <div className="flex items-baseline justify-between gap-3 text-[15px]"><span className="flex min-w-0 items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="truncate">{r.category}</span></span><span className="shrink-0 tabular-nums text-muted">{formatINR(r.totalPaise)} · {pct}%</span></div>
            <div className="mt-1.5 h-2 rounded-full bg-fill" aria-hidden><div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: PALETTE[i % PALETTE.length] }} /></div>
          </li>
        );
      })}
    </ul>
  );
}
