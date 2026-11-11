import { HandCoins, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DateRange, parseSort, SearchBox, SortSelect, type SortKey } from '@/components/filters';
import { Button, IconButton } from '@/components/ui/Button';
import { Money, PageHeader, Pagination, Section, Segmented, Stat } from '@/components/ui/display';
import { Boundary, EmptyState, ErrorState, ListSkeleton, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useDateFormat } from '@/hooks/useAuth';
import { useDebounced } from '@/hooks/useDebounced';
import { ApiError } from '@/lib/api';
import { INCOME_SOURCES, methodLabel, sourceLabel } from '@/lib/constants';
import { formatDate, istEnd, istStart } from '@/lib/dates';
import type { Income } from '@/lib/types';
import { toast } from '@/store/toast';
import { useUi } from '@/store/ui';
import { useDeleteIncome, useIncomeList, useParentSummary } from './api';
import { IncomeForm } from './IncomeForm';

function IncomeRow({ i, onEdit, onDelete }: { i: Income; onEdit: () => void; onDelete: () => void }) {
  const fmt = useDateFormat();
  return (
    <li className="flex items-center gap-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{i.description || sourceLabel(i.source)}</p>
        <p className="truncate text-xs text-muted">{sourceLabel(i.source)} · {methodLabel(i.paymentMethod)} · {formatDate(i.date, fmt)}</p>
      </div>
      <Money paise={i.amountPaise} sign className="mr-1 text-sm font-medium text-good" />
      <IconButton label={`Edit ${i.description || sourceLabel(i.source)}`} onClick={onEdit}><Pencil className="h-4 w-4" /></IconButton>
      <IconButton label={`Delete ${i.description || sourceLabel(i.source)}`} onClick={onDelete}><Trash2 className="h-4 w-4" /></IconButton>
    </li>
  );
}

export default function IncomePage() {
  const fmt = useDateFormat();
  const openQuick = useUi((s) => s.openQuick);
  const [view, setView] = useState<'all' | 'parents'>('all');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [sort, setSort] = useState<SortKey>('date:desc');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Income | null>(null);
  const [deleting, setDeleting] = useState<Income | null>(null);
  const del = useDeleteIncome();
  const summary = useParentSummary();
  const q = useIncomeList({
    page, ...parseSort(sort), search: useDebounced(search) || undefined, source: source || undefined,
    from: range.from ? istStart(range.from) : undefined, to: range.to ? istEnd(range.to) : undefined,
  });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const filtered = !!(search || source || range.from || range.to);

  const actions = (i: Income) => ({ onEdit: () => setEditing(i), onDelete: () => setDeleting(i) });

  return (
    <>
      <PageHeader title="Income" description="Money received from parents, scholarships, work and more."
        actions={<>
          <Button variant="secondary" onClick={() => openQuick({ type: 'income', source: 'parents' })}>Money from parents</Button>
          <Button onClick={() => openQuick({ type: 'income' })}><Plus className="h-4 w-4" />Add income</Button>
        </>} />

      <Section title="From parents" className="mb-6">
        <Boundary q={summary} skeleton={<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>}>
          {(s) => (
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
              <Stat label="Received in total" value={<Money paise={s.totalPaise} />} />
              <Stat label="This month" value={<Money paise={s.thisMonthPaise} />} />
              <Stat label="This year" value={<Money paise={s.thisYearPaise} />} />
              <Stat label="Last received" value={<span className="text-base">{s.lastReceivedDate ? formatDate(s.lastReceivedDate, fmt) : 'Not yet'}</span>} />
            </div>
          )}
        </Boundary>
        <p className="mt-4 text-xs text-muted">Counts “Money from parents” and “Monthly pocket money”.</p>
      </Section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented label="Show" value={view} onChange={setView} options={[{ value: 'all', label: 'All income' }, { value: 'parents', label: 'Allowance history' }]} />
        {view === 'all' && (
          <>
            <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search income" />
            <Select aria-label="Source" value={source} onChange={(e) => reset(setSource)(e.target.value)} className="w-auto"><option value="">All sources</option>{INCOME_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
            <DateRange {...range} onChange={reset(setRange)} />
            <SortSelect value={sort} onChange={reset(setSort)} />
          </>
        )}
      </div>

      <Section flush>
        {view === 'parents' ? (
          <Boundary q={summary} skeleton={<div className="px-4"><ListSkeleton /></div>}>
            {(s) => s.history.length === 0
              ? <EmptyState icon={HandCoins} title="No allowance recorded yet" description="Record money from your parents and it will show up here." action={<Button onClick={() => openQuick({ type: 'income', source: 'parents' })}>Add money from parents</Button>} />
              : <ul className="divide-y divide-line">{s.history.map((i) => <IncomeRow key={i.id} i={i} {...actions(i)} />)}</ul>}
          </Boundary>
        ) : q.isPending ? <div className="px-4"><ListSkeleton /></div>
          : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          : q.data.items.length === 0 ? (
            <EmptyState icon={HandCoins} title={filtered ? 'No income matches these filters' : 'No income yet'}
              description={filtered ? 'Try clearing a filter.' : 'Record money you receive so your balance stays accurate.'}
              action={!filtered && <Button onClick={() => openQuick({ type: 'income' })}><Plus className="h-4 w-4" />Add income</Button>} />
          ) : (
            <>
              <ul className="divide-y divide-line">{q.data.items.map((i) => <IncomeRow key={i.id} i={i} {...actions(i)} />)}</ul>
              <Pagination meta={q.data.meta} onPage={setPage} />
            </>
          )}
      </Section>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit income">{editing && <IncomeForm item={editing} onDone={() => setEditing(null)} />}</Modal>
      <ConfirmDialog open={!!deleting} title="Delete this income?" loading={del.isPending}
        message={deleting && <>This removes <Money paise={deleting.amountPaise} /> from your balance.</>}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id, {
          onSuccess: () => { toast.success('Income deleted'); setDeleting(null); },
          onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Couldn’t delete. Try again.'),
        })} />
    </>
  );
}
