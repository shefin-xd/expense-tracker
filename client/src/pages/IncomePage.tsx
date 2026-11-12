import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { RowActions } from '@/components/RowActions';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Confirm';
import { FilterDate, FilterSelect } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Money, PageHeader, Pagination, Panel, Stat } from '@/components/ui/Parts';
import { EmptyState, ErrorState, ListSkeleton, Skeleton } from '@/components/ui/States';
import { IncomeForm } from '@/features/income/forms';
import { useDateFormat } from '@/hooks/useUser';
import { useDebounced } from '@/hooks/useDebounced';
import { api } from '@/services/api';
import { useIncome, useParentSummary, useSave } from '@/services/queries';
import { INCOME_SOURCES, INCOME_SOURCE_LABELS, PAYMENT_METHOD_LABELS, type Income } from '@/types/api';
import { dayEnd, dayStart, formatDate } from '@/utils/date';

const SORTS = { newest: ['date', 'desc'], oldest: ['date', 'asc'], highest: ['amount', 'desc'], lowest: ['amount', 'asc'] } as const;

export default function IncomePage() {
  const fmt = useDateFormat();
  const parent = useParentSummary();
  const [f, setF] = useState({ search: '', source: '', from: '', to: '', sort: 'newest' as keyof typeof SORTS, page: 1 });
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const search = useDebounced(f.search);
  const [sortBy, order] = SORTS[f.sort];
  const bad = !!f.from && !!f.to && f.from > f.to;
  const q = useIncome({ page: f.page, limit: 15, search: search || undefined, source: f.source || undefined, from: f.from && !bad ? dayStart(f.from).toISOString() : undefined, to: f.to && !bad ? dayEnd(f.to).toISOString() : undefined, sortBy, order });
  const [modal, setModal] = useState<{ kind: 'add' | 'received' | 'edit' | 'delete'; item?: Income } | null>(null);
  const close = () => setModal(null);
  const del = useSave((id: string) => api.del(`/income/${id}`), 'Income deleted');
  const filtered = !!(search || f.source || f.from || f.to);
  const p = parent.data;
  const item = modal?.item;

  return (
    <>
      <PageHeader title="Income" description="Money that came to you, including what your parents send."
        actions={<><Button variant="secondary" onClick={() => setModal({ kind: 'received' })}>Money received</Button><Button onClick={() => setModal({ kind: 'add' })}><Plus className="size-4" aria-hidden />Add income</Button></>} />

      <Panel title="From your parents" className="mb-6">
        {parent.isPending ? <Skeleton className="h-14 w-full" /> : parent.isError ? <ErrorState message={parent.error.message} onRetry={() => parent.refetch()} /> : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Stat label="Total received" value={<Money paise={p?.totalPaise ?? 0} />} />
            <Stat label="This month" value={<Money paise={p?.thisMonthPaise ?? 0} />} />
            <Stat label="This year" value={<Money paise={p?.thisYearPaise ?? 0} />} />
            <Stat label="Last received" value={p?.lastReceivedDate ? formatDate(p.lastReceivedDate, fmt) : 'Not yet'} />
          </dl>
        )}
        <p className="mt-4 text-[13px] text-muted">Counts income marked as money from parents or monthly pocket money.</p>
      </Panel>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" aria-label="Search income" placeholder="Search income" value={f.search} onChange={(ev) => set({ search: ev.target.value })} className="h-9 w-full rounded-md border border-border-strong bg-bg pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
        <FilterSelect label="Source" value={f.source} onChange={(ev) => set({ source: ev.target.value })}><option value="">All sources</option>{INCOME_SOURCES.map((s) => <option key={s} value={s}>{INCOME_SOURCE_LABELS[s]}</option>)}</FilterSelect>
        <FilterDate label="From date" value={f.from} onChange={(ev) => set({ from: ev.target.value })} />
        <FilterDate label="To date" value={f.to} onChange={(ev) => set({ to: ev.target.value })} />
        <FilterSelect label="Sort" value={f.sort} onChange={(ev) => set({ sort: ev.target.value as keyof typeof SORTS })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></FilterSelect>
      </div>
      {bad && <p role="alert" className="mb-3 text-[13px] text-danger">The start date must be on or before the end date.</p>}

      {q.isPending ? <ListSkeleton /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        : q.data.items.length ? (
          <ul className="divide-y rounded-md border">
            {q.data.items.map((x) => (
              <li key={x.id} className="flex items-center gap-2 py-2 pl-4 pr-2">
                <div className="min-w-0 flex-1 py-1">
                  <p className="truncate text-sm font-medium">{INCOME_SOURCE_LABELS[x.source]}{x.description ? `: ${x.description}` : ''}</p>
                  <p className="truncate text-[13px] text-muted">{PAYMENT_METHOD_LABELS[x.paymentMethod]} · {formatDate(x.date, fmt)}</p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-accent">+<Money paise={x.amountPaise} /></span>
                <RowActions name={INCOME_SOURCE_LABELS[x.source]} onEdit={() => setModal({ kind: 'edit', item: x })} onDelete={() => setModal({ kind: 'delete', item: x })} />
              </li>
            ))}
          </ul>
        ) : <EmptyState title={filtered ? 'No income matches' : 'No income recorded yet'} description={filtered ? 'Try removing a filter or widening the dates.' : 'Record the money your parents sent or anything else you received, so your balance starts right.'} action={!filtered && <Button onClick={() => setModal({ kind: 'received' })}>Add money received</Button>} />}
      <Pagination meta={q.data?.meta} onPage={(page) => set({ page })} />

      <Modal open={modal?.kind === 'add'} onClose={close} title="Add income"><IncomeForm onDone={close} /></Modal>
      <Modal open={modal?.kind === 'received'} onClose={close} title="Add money received"><IncomeForm presetSource="parents" onDone={close} /></Modal>
      <Modal open={modal?.kind === 'edit'} onClose={close} title="Edit income">{item && <IncomeForm income={item} onDone={close} />}</Modal>
      <ConfirmDialog open={modal?.kind === 'delete'} title="Delete this income?" message="It will be removed and your balance will go down by this amount." confirmLabel="Delete income" onConfirm={() => del.mutateAsync(item!.id)} onClose={close} />
    </>
  );
}
