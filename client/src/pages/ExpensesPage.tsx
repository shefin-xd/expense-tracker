import { Plus, Search, Tags } from 'lucide-react';
import { useState } from 'react';
import { RowActions } from '@/components/RowActions';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Confirm';
import { FilterDate, FilterSelect } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Money, PageHeader, Pagination } from '@/components/ui/Parts';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';
import { CategoryManager } from '@/features/expenses/CategoryManager';
import { ExpenseForm } from '@/features/expenses/forms';
import { useDateFormat } from '@/hooks/useUser';
import { useDebounced } from '@/hooks/useDebounced';
import { api } from '@/services/api';
import { useCategories, useExpenses, useSave } from '@/services/queries';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type Expense } from '@/types/api';
import { dayEnd, dayStart, formatDate } from '@/utils/date';

const SORTS = { newest: ['date', 'desc'], oldest: ['date', 'asc'], highest: ['amount', 'desc'], lowest: ['amount', 'asc'] } as const;

export default function ExpensesPage() {
  const fmt = useDateFormat();
  const [f, setF] = useState({ search: '', category: '', method: '', from: '', to: '', sort: 'newest' as keyof typeof SORTS, page: 1 });
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const search = useDebounced(f.search);
  const cats = useCategories();
  const [sortBy, order] = SORTS[f.sort];
  const bad = !!f.from && !!f.to && f.from > f.to;
  const q = useExpenses({ page: f.page, limit: 15, search: search || undefined, category: f.category || undefined, paymentMethod: f.method || undefined, from: f.from && !bad ? dayStart(f.from).toISOString() : undefined, to: f.to && !bad ? dayEnd(f.to).toISOString() : undefined, sortBy, order });
  const [modal, setModal] = useState<{ kind: 'add' | 'edit' | 'view' | 'delete' | 'categories'; item?: Expense } | null>(null);
  const close = () => setModal(null);
  const del = useSave((id: string) => api.del(`/expenses/${id}`), 'Expense deleted');
  const names = [...(cats.data?.defaults ?? []), ...(cats.data?.custom.map((c) => c.name) ?? [])];
  const filtered = !!(search || f.category || f.method || f.from || f.to);
  const e = modal?.item;

  return (
    <>
      <PageHeader title="Expenses" description="What you spent, and where."
        actions={<><Button variant="secondary" onClick={() => setModal({ kind: 'categories' })}><Tags className="size-4" aria-hidden />Categories</Button><Button onClick={() => setModal({ kind: 'add' })}><Plus className="size-4" aria-hidden />Add expense</Button></>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" aria-label="Search expenses" placeholder="Search expenses" value={f.search} onChange={(ev) => set({ search: ev.target.value })} className="h-9 w-full rounded-md border border-border-strong bg-bg pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
        <FilterSelect label="Category" value={f.category} onChange={(ev) => set({ category: ev.target.value })}><option value="">All categories</option>{names.map((n) => <option key={n}>{n}</option>)}</FilterSelect>
        <FilterSelect label="Payment method" value={f.method} onChange={(ev) => set({ method: ev.target.value })}><option value="">Any method</option>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</FilterSelect>
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
                <button onClick={() => setModal({ kind: 'view', item: x })} className="min-w-0 flex-1 py-1 text-left">
                  <p className="truncate text-sm font-medium">{x.title}</p>
                  <p className="truncate text-[13px] text-muted">{x.category} · {PAYMENT_METHOD_LABELS[x.paymentMethod]} · {formatDate(x.date, fmt)}</p>
                </button>
                <Money paise={x.amountPaise} className="shrink-0 text-sm font-medium" />
                <RowActions name={x.title} onEdit={() => setModal({ kind: 'edit', item: x })} onDelete={() => setModal({ kind: 'delete', item: x })} />
              </li>
            ))}
          </ul>
        ) : <EmptyState title={filtered ? 'No expenses match' : 'No expenses yet'} description={filtered ? 'Try removing a filter or widening the dates.' : 'Log your first expense. It only takes an amount and a category.'} action={!filtered && <Button onClick={() => setModal({ kind: 'add' })}>Add expense</Button>} />}
      <Pagination meta={q.data?.meta} onPage={(page) => set({ page })} />

      <Modal open={modal?.kind === 'add'} onClose={close} title="Add expense"><ExpenseForm onDone={close} /></Modal>
      <Modal open={modal?.kind === 'edit'} onClose={close} title="Edit expense">{e && <ExpenseForm expense={e} onDone={close} />}</Modal>
      <Modal open={modal?.kind === 'categories'} onClose={close} title="Expense categories"><CategoryManager /></Modal>
      <Modal open={modal?.kind === 'view'} onClose={close} title="Expense details">
        {e && (
          <div className="space-y-5">
            <div><p className="text-sm text-muted">{e.title}</p><p className="mt-1 text-3xl font-semibold tabular-nums"><Money paise={e.amountPaise} /></p></div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-[13px] text-muted">Category</dt><dd className="mt-0.5">{e.category}</dd></div>
              <div><dt className="text-[13px] text-muted">Date</dt><dd className="mt-0.5">{formatDate(e.date, fmt)}</dd></div>
              <div><dt className="text-[13px] text-muted">Paid with</dt><dd className="mt-0.5">{PAYMENT_METHOD_LABELS[e.paymentMethod]}</dd></div>
              {e.description && <div className="col-span-2"><dt className="text-[13px] text-muted">Description</dt><dd className="mt-0.5">{e.description}</dd></div>}
              {e.notes && <div className="col-span-2"><dt className="text-[13px] text-muted">Notes</dt><dd className="mt-0.5 whitespace-pre-wrap">{e.notes}</dd></div>}
              {e.receiptUrl && <div className="col-span-2"><dt className="text-[13px] text-muted">Receipt</dt><dd className="mt-0.5"><a href={e.receiptUrl} target="_blank" rel="noreferrer noopener" className="text-accent underline underline-offset-4">Open receipt</a></dd></div>}
            </dl>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModal({ kind: 'delete', item: e })}>Delete</Button><Button onClick={() => setModal({ kind: 'edit', item: e })}>Edit</Button></div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={modal?.kind === 'delete'} title="Delete this expense?" message={e ? `"${e.title}" will be removed and its amount returns to your balance.` : ''} confirmLabel="Delete expense" onConfirm={() => del.mutateAsync(e!.id)} onClose={close} />
    </>
  );
}
