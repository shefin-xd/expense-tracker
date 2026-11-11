import { useQuery } from '@tanstack/react-query';
import { GraduationCap, HandCoins, Plus, Receipt, Users, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TransactionRow } from '@/components/TransactionRow';
import { Button } from '@/components/ui/Button';
import { Badge, Money, PageHeader, Section, Segmented, Stat } from '@/components/ui/display';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { Link } from 'react-router-dom';
import { useDateFormat, useUser } from '@/hooks/useAuth';
import { useChartColors } from '@/hooks/useTheme';
import { api } from '@/lib/api';
import { formatDate, istEnd, istStart, relativeDue } from '@/lib/dates';
import { formatINR, formatINRShort } from '@/lib/money';
import type { Dashboard } from '@/lib/types';
import { useUi } from '@/store/ui';
import { useFees } from '../fees/api';
import { defaultCustom, PRESETS, presetRange, type Preset } from './ranges';
import { buildSeries, buildSlices } from './series';

interface TipProps { active?: boolean; payload?: readonly { value?: unknown; payload?: { name?: string } }[]; label?: unknown }
function MoneyTip({ active, payload, label }: TipProps) {
  const v = payload?.[0]?.value;
  if (!active || typeof v !== 'number') return null;
  return (
    <div className="rounded border border-line bg-surface px-2.5 py-1.5 text-xs shadow-pop">
      <p className="text-muted">{String(payload?.[0]?.payload?.name ?? label ?? '')}</p>
      <p className="num font-medium">{formatINR(v)}</p>
    </div>
  );
}

function SpendingChart({ data, colors }: { data: { key: string; label: string; totalPaise: number }[]; colors: ReturnType<typeof useChartColors> }) {
  if (data.length === 0 || data.every((d) => d.totalPaise === 0))
    return <EmptyState icon={Receipt} title="No spending in this period" description="Pick another period, or add an expense." />;
  const rows = data.map((d) => ({ ...d, name: d.label }));
  return (
    <div role="img" aria-label="Spending over time" className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: colors.axis, fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: colors.axis, fontSize: 11 }} tickFormatter={(v: number) => formatINRShort(v)} />
          <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={(p) => <MoneyTip {...(p as TipProps)} />} />
          <Bar dataKey="totalPaise" fill={colors.main} radius={[2, 2, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryDonut({ rows, colors }: { rows: Dashboard['categoryBreakdown']; colors: ReturnType<typeof useChartColors> }) {
  const slices = useMemo(() => buildSlices(rows), [rows]);
  if (slices.length === 0) return <EmptyState icon={Receipt} title="No categorised expenses yet" />;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div role="img" aria-label="Expenses by category" className="h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} stroke="none" paddingAngle={1} isAnimationActive={false}>
              {slices.map((_, i) => <Cell key={i} fill={colors.ramp[i % colors.ramp.length]} />)}
            </Pie>
            <Tooltip content={(p) => <MoneyTip {...(p as TipProps)} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colors.ramp[i % colors.ramp.length] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <Money paise={s.value} className="text-muted" />
            <span className="num w-9 text-right text-xs text-muted">{s.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardPage() {
  const user = useUser();
  const fmt = useDateFormat();
  const openQuick = useUi((s) => s.openQuick);
  const colors = useChartColors();
  const [preset, setPreset] = useState<Preset>('month');
  const [custom, setCustom] = useState(defaultCustom);
  const range = preset === 'custom' ? custom : presetRange(preset);
  const valid = range.from !== '' && range.to !== '' && range.from <= range.to;

  const q = useQuery({
    queryKey: ['dashboard', range.from, range.to],
    queryFn: () => api.get<Dashboard>('/dashboard', { from: istStart(range.from), to: istEnd(range.to) }),
    enabled: valid,
    placeholderData: (p) => p,
  });
  const fees = useFees();
  const dueFees = (fees.data?.items ?? []).filter((f) => f.status !== 'paid');
  const feesRemaining = dueFees.reduce((s, f) => s + f.remainingPaise, 0);
  const overdueCount = dueFees.filter((f) => f.status === 'overdue').length;
  const series = useMemo(() => (q.data ? buildSeries(q.data.spendingSeries, range.from, range.to) : []), [q.data, range.from, range.to]);
  const d = q.data;

  return (
    <>
      <PageHeader title={`Hi, ${user.name.split(' ')[0]}`} description="Here’s where your money stands today." />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button variant="secondary" onClick={() => openQuick({ type: 'expense' })}><Plus className="h-4 w-4" />Add expense</Button>
        <Button variant="secondary" onClick={() => openQuick({ type: 'income' })}><Wallet className="h-4 w-4" />Add income</Button>
        <Button variant="secondary" onClick={() => openQuick({ type: 'fee' })}><GraduationCap className="h-4 w-4" />Add payment</Button>
        <Button variant="secondary" onClick={() => openQuick({ type: 'income', source: 'parents' })}><HandCoins className="h-4 w-4" />Money received</Button>
      </div>

      {q.isError && !d ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
        <div className="space-y-6">
          <Section>
            <p className="text-[13px] text-muted">Available balance</p>
            {d ? <p className="num mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{formatINR(d.balance.currentPaise)}</p> : <Skeleton className="mt-2 h-11 w-56" />}
            {d && (d.balance.lentOutstandingPaise > 0 || d.balance.borrowedOutstandingPaise > 0) && (
              <p className="mt-2 text-sm text-muted">
                {d.balance.lentOutstandingPaise > 0 && <>Friends owe you <Money paise={d.balance.lentOutstandingPaise} /></>}
                {d.balance.lentOutstandingPaise > 0 && d.balance.borrowedOutstandingPaise > 0 && ' · '}
                {d.balance.borrowedOutstandingPaise > 0 && <>You owe <Money paise={d.balance.borrowedOutstandingPaise} /></>}
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-line pt-5 lg:grid-cols-4">
              <Stat label="Total received" value={d ? <Money paise={d.allTime.totalIncomePaise} /> : <Skeleton className="h-7 w-24" />} />
              <Stat label="Total spent" value={d ? <Money paise={d.allTime.totalExpensesPaise} /> : <Skeleton className="h-7 w-24" />} hint="Expenses and fee payments" />
              <Stat label="Saved in goals" value={d ? <Money paise={d.totalSavingsPaise} /> : <Skeleton className="h-7 w-24" />} />
              <Stat label="Fees still to pay" value={fees.data ? <Money paise={feesRemaining} /> : <Skeleton className="h-7 w-24" />}
                hint={overdueCount ? `${overdueCount} overdue` : dueFees.length ? `${dueFees.length} upcoming` : 'Nothing due'} />
            </div>
          </Section>

          <Section title="Spending overview" action={<span className="text-xs text-muted">{formatDate(range.from, fmt)} to {formatDate(range.to, fmt)}</span>}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Segmented label="Period" value={preset} onChange={setPreset} options={PRESETS} />
              {preset === 'custom' && (
                <div className="flex items-center gap-2">
                  <Input type="date" aria-label="From date" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="w-[9.5rem]" />
                  <span className="text-sm text-faint" aria-hidden>to</span>
                  <Input type="date" aria-label="To date" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="w-[9.5rem]" />
                </div>
              )}
            </div>
            {!valid ? <p className="py-8 text-center text-sm text-muted">Choose a start and end date.</p> : (
              <>
                <div className="mb-4 grid grid-cols-3 gap-4">
                  <Stat label="Income" value={d ? <Money paise={d.range.totalIncomePaise} /> : <Skeleton className="h-7 w-20" />} />
                  <Stat label="Spent" value={d ? <Money paise={d.range.totalExpensesPaise} /> : <Skeleton className="h-7 w-20" />} />
                  <Stat label="Net" value={d ? <Money paise={d.range.totalIncomePaise - d.range.totalExpensesPaise} sign /> : <Skeleton className="h-7 w-20" />} />
                </div>
                {d ? <SpendingChart data={series} colors={colors} /> : <Skeleton className="h-56 w-full" />}
              </>
            )}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Expenses by category">
              {d ? <CategoryDonut rows={d.categoryBreakdown} colors={colors} /> : <Skeleton className="h-40 w-full" />}
              <p className="mt-3 text-xs text-muted">Fee payments are tracked on the Fees page.</p>
            </Section>

            <Section title="Upcoming payments" action={<Link to="/fees" className="text-xs font-medium text-accent hover:underline">View fees</Link>} flush>
              {!d || fees.isPending ? <div className="space-y-3 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                : d.upcoming.fees.length === 0 && d.upcoming.repayments.length === 0
                  ? <EmptyState icon={GraduationCap} title="Nothing due" description="Fee deadlines and friend repayments will appear here." />
                  : (
                    <ul className="divide-y divide-line">
                      {d.upcoming.fees.map((f) => (
                        <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{f.title}</p>
                            <p className="text-xs text-muted">{relativeDue(f.dueDate)} · {formatDate(f.dueDate, fmt)}</p>
                          </div>
                          {f.status === 'overdue' && <Badge tone="danger">Overdue</Badge>}
                          <Money paise={f.remainingPaise} className="text-sm font-medium" />
                        </li>
                      ))}
                      {d.upcoming.repayments.map((l) => (
                        <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                          <Users className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{l.direction === 'lent' ? `${l.person} owes you` : `You owe ${l.person}`}</p>
                            <p className="text-xs text-muted">{l.expectedDate ? `${relativeDue(l.expectedDate)} · ${formatDate(l.expectedDate, fmt)}` : ''}</p>
                          </div>
                          <Money paise={l.remainingPaise} className="text-sm font-medium" />
                        </li>
                      ))}
                    </ul>
                  )}
            </Section>
          </div>

          <Section title="Recent transactions" action={<Link to="/transactions" className="text-xs font-medium text-accent hover:underline">View all</Link>} flush>
            {!d ? <div className="space-y-3 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              : d.recentTransactions.length === 0
                ? <EmptyState icon={Receipt} title="No transactions yet" description="Add an expense or record money you received to see it here."
                    action={<Button onClick={() => openQuick({ type: 'expense' })}><Plus className="h-4 w-4" />Add expense</Button>} />
                : <ul className="divide-y divide-line">{d.recentTransactions.map((t) => <TransactionRow key={t.id} t={t} />)}</ul>}
          </Section>
        </div>
      )}
    </>
  );
}
