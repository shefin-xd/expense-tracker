import { Pencil, Plus, Receipt, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DateRange, parseSort, SearchBox, SortSelect, type SortKey } from '@/components/filters';
import { Button } from '@/components/ui/Button';
import { Money, PageHeader, Pagination, Section } from '@/components/ui/display';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useDateFormat } from '@/hooks/useAuth';
import { useDebounced } from '@/hooks/useDebounced';
import { ApiError } from '@/lib/api';
import { methodLabel, PAYMENT_METHODS } from '@/lib/constants';
import { formatDate, istEnd, istStart } from '@/lib/dates';
import type { Expense } from '@/lib/types';
import { toast } from '@/store/toast';
import { useUi } from '@/store/ui';
import { useCategories, useDeleteExpense, useExpenses } from './api';
import { CategoryManager } from './CategoryManager';
import { ExpenseForm } from './ExpenseForm';

export default function ExpensesPage() {
  const fmt = useDateFormat();
  const openQuick = useUi((s) => s.openQuick);
  const cats = useCategories();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [sort, setSort] = useState<SortKey>('date:desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [managing, setManaging] = useState(false);
  const del = useDeleteExpense();

  const q = useExpenses({
    page, ...parseSort(sort), search: useDebounced(search) || undefined, category: category || undefined, paymentMethod: method || undefined,
    from: range.from ? istStart(range.from) : undefined, to: range.to ? istEnd(range.to) : undefined,
  });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const filtered = !!(search || category || method || range.from || range.to);
  const allCats = [...(cats.data?.defaults ?? []), ...(cats.data?.custom.map((c) => c.name) ?? [])];

  return (
    <>
      <PageHeader title="Expenses" description="Everything you’ve spent, in one place."
        actions={<>
          <Button variant="secondary" onClick={() => setManaging(true)}><Tags className="h-4 w-4" />Categories</Button>
          <Button onClick={() => openQuick({ type: 'expense' })}><Plus className="h-4 w-4" />Add expense</Button>
        </>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search expenses" />
        <Select aria-label="Category" value={category} onChange={(e) => reset(setCategory)(e.target.value)} className="w-auto"><option value="">All categories</option>{allCats.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select aria-label="Payment method" value={method} onChange={(e) => reset(setMethod)(e.target.value)} className="w-auto"><option value="">All methods</option>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>
        <DateRange {...range} onChange={reset(setRange)} />
        <SortSelect value={sort} onChange={reset(setSort)} />
      </div>

      <Section flush>
        {q.isPending ? <div className="px-4"><ListSkeleton /></div>
          : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          : q.data.items.length === 0 ? (
            <EmptyState icon={Receipt} title={filtered ? 'No expenses match these filters' : 'No expenses yet'}
              description={filtered ? 'Try clearing a filter or searching for something else.' : 'Add your first expense to start seeing where your money goes.'}
              action={!filtered && <Button onClick={() => openQuick({ type: 'expense' })}><Plus className="h-4 w-4" />Add expense</Button>} />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {q.data.items.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => setSelected(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        <p className="truncate text-xs text-muted">{e.category} · {methodLabel(e.paymentMethod)} · {formatDate(e.date, fmt)}</p>
                      </div>
                      <Money paise={e.amountPaise} className="text-sm font-medium" />
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination meta={q.data.meta} onPage={setPage} />
            </>
          )}
      </Section>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Expense details">
        {selected && (
          <div>
            <p className="num text-2xl font-semibold"><Money paise={selected.amountPaise} /></p>
            <p className="mt-1 text-sm">{selected.title}</p>
            <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
              {([['Category', selected.category], ['Date', formatDate(selected.date, fmt)], ['Paid with', methodLabel(selected.paymentMethod)],
                ['Description', selected.description], ['Notes', selected.notes]] as const).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
              ))}
              {selected.receiptUrl && (
                <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">Receipt</dt>
                  <dd><a href={selected.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Open link</a></dd></div>
              )}
            </dl>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="danger" onClick={() => { setDeleting(selected); setSelected(null); }}><Trash2 className="h-4 w-4" />Delete</Button>
              <Button onClick={() => { setEditing(selected); setSelected(null); }}><Pencil className="h-4 w-4" />Edit</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit expense">
        {editing && <ExpenseForm item={editing} onDone={() => setEditing(null)} />}
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete this expense?" loading={del.isPending}
        message={deleting && <>“{deleting.title}” will be removed and your balance will go back up by <Money paise={deleting.amountPaise} />.</>}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id, {
          onSuccess: () => { toast.success('Expense deleted'); setDeleting(null); },
          onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Couldn’t delete. Try again.'),
        })} />

      <Modal open={managing} onClose={() => setManaging(false)} title="Manage categories"><CategoryManager /></Modal>
    </>
  );
}

