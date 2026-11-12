import { ArrowDownToLine, CreditCard, HandCoins, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TransactionList } from '@/components/TransactionList';
import { Button } from '@/components/ui/Button';
import { FilterDate, FilterSelect } from '@/components/ui/Field';
import { Money, Panel, StatusBadge, Stat } from '@/components/ui/Parts';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { CategoryBars, SpendingChart, buildSeries } from '@/features/dashboard/charts';
import { useQuickAdd } from '@/features/quickadd/QuickAdd';
import { useDateFormat } from '@/hooks/useUser';
import { useDashboard } from '@/services/queries';
import { formatDate, relativeDue, todayKey } from '@/utils/date';
import { RANGE_OPTIONS, rangeDays, rangeToIso, type RangeKey } from '@/utils/ranges';

export default function DashboardPage() {
  const open = useQuickAdd((s) => s.open);
  const fmt = useDateFormat();
  const [key, setKey] = useState<RangeKey>('month');
  const [custom, setCustom] = useState({ from: rangeDays('month').from, to: todayKey() });
  const days = useMemo(() => (key === 'custom' ? custom : rangeDays(key)), [key, custom]);
  const valid = days.from <= days.to;
  const q = useDashboard(valid ? rangeToIso(days) : rangeToIso(rangeDays('month')));
  const d = q.data;
  const series = useMemo(() => (d && valid ? buildSeries(days, d.spendingSeries) : []), [d, days, valid]);

  const totalReceived = d?.allTime.totalIncomePaise ?? 0;
  const net = d ? d.range.totalIncomePaise - d.range.totalExpensesPaise : 0;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Dashboard</h1>

      <section aria-label="Balance overview" className="rounded-md border p-5 sm:p-6">
        <p className="text-sm text-muted">Available balance</p>
        {q.isPending ? <Skeleton className="mt-2 h-11 w-56" /> : (
          <p className={`mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl ${(d?.balance.currentPaise ?? 0) < 0 ? 'text-danger' : ''}`}><Money paise={d?.balance.currentPaise ?? 0} /></p>
        )}
        <p className="mt-2 text-[13px] text-muted">
          {d && (d.balance.lentOutstandingPaise > 0 || d.balance.borrowedOutstandingPaise > 0)
            ? <>Friends owe you <Money paise={d.balance.lentOutstandingPaise} /> · You owe friends <Money paise={d.balance.borrowedOutstandingPaise} /> <Link to="/borrow-lend" className="underline underline-offset-4">View</Link></>
            : 'Includes everything you have received, spent and paid so far.'}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-5 sm:grid-cols-4">
          <Stat label="Money received" value={q.isPending ? '–' : <Money paise={totalReceived} decimals={false} />} />
          <Stat label="Total expenses" value={q.isPending ? '–' : <Money paise={d?.allTime.totalExpensesPaise ?? 0} decimals={false} />} />
          <Stat label="Saved in goals" value={q.isPending ? '–' : <Money paise={d?.totalSavingsPaise ?? 0} decimals={false} />} />
          <Stat label="Upcoming payments" value={q.isPending ? '–' : String((d?.upcoming.fees.length ?? 0) + (d?.upcoming.repayments.length ?? 0))} />
        </dl>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Quick actions" role="group">
        <Button variant="secondary" onClick={() => open('expense')}><Receipt className="size-4" aria-hidden />Add expense</Button>
        <Button variant="secondary" onClick={() => open('income')}><ArrowDownToLine className="size-4" aria-hidden />Add income</Button>
        <Button variant="secondary" onClick={() => open('payment')}><CreditCard className="size-4" aria-hidden />Add payment</Button>
        <Button variant="secondary" onClick={() => open('received')}><HandCoins className="size-4" aria-hidden />Money received</Button>
      </div>

      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Spending overview" action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FilterSelect label="Period" value={key} onChange={(e) => setKey(e.target.value as RangeKey)}>{RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</FilterSelect>
            {key === 'custom' && <><FilterDate label="From" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /><FilterDate label="To" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></>}
          </div>}>
          {!valid ? <p className="py-10 text-center text-sm text-danger" role="alert">The start date must be on or before the end date.</p> : q.isPending ? <Skeleton className="h-52 w-full" /> : (
            <>
              <p className="mb-3 text-[13px] text-muted">
                <span className="tabular-nums">{formatDate(days.from, fmt)} to {formatDate(days.to, fmt)}</span> · Spent <Money paise={d?.range.totalExpensesPaise ?? 0} /> · Received <Money paise={d?.range.totalIncomePaise ?? 0} /> · {net >= 0 ? 'Left over' : 'Over by'} <Money paise={Math.abs(net)} />
              </p>
              <SpendingChart data={series} />
            </>
          )}
        </Panel>
        <Panel title="Where it went">{q.isPending ? <Skeleton className="h-52 w-full" /> : <CategoryBars items={d?.categoryBreakdown ?? []} />}</Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recent transactions" flush action={<Link to="/transactions" className="text-[13px] font-medium text-accent underline underline-offset-4">See all</Link>}>
          {q.isPending ? <div className="space-y-3 p-4"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
            : d?.recentTransactions.length ? <TransactionList items={d.recentTransactions.slice(0, 6)} />
            : <div className="p-4"><EmptyState title="Nothing recorded yet" description="Add the money you have received, then your first expense." action={<Button onClick={() => open('income')}>Add income</Button>} /></div>}
        </Panel>
        <Panel title="Upcoming payments" flush action={<Link to="/fees" className="text-[13px] font-medium text-accent underline underline-offset-4">Fees & payments</Link>}>
          {q.isPending ? <div className="space-y-3 p-4"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
            : (d?.upcoming.fees.length || d?.upcoming.repayments.length) ? (
              <ul className="divide-y">
                {d!.upcoming.fees.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{f.title}</p><p className="text-[13px] text-muted">{formatDate(f.dueDate, fmt)} · {relativeDue(f.dueDate)}</p></div>
                    <div className="shrink-0 text-right"><Money paise={f.remainingPaise} className="text-sm font-medium" /><div className="mt-1"><StatusBadge status={f.status} /></div></div>
                  </li>
                ))}
                {d!.upcoming.repayments.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{l.direction === 'lent' ? `${l.person} to pay you back` : `Repay ${l.person}`}</p><p className="text-[13px] text-muted">{formatDate(l.expectedDate, fmt)} · {relativeDue(l.expectedDate)}</p></div>
                    <div className="shrink-0 text-right"><Money paise={l.remainingPaise} className="text-sm font-medium" /><div className="mt-1"><StatusBadge status={l.status} /></div></div>
                  </li>
                ))}
              </ul>
            ) : <div className="p-4"><EmptyState title="Nothing due" description="Upcoming fees and repayments will be listed here." /></div>}
        </Panel>
      </div>
    </div>
  );
}
