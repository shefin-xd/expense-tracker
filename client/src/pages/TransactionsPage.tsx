import { Search } from 'lucide-react';
import { useState } from 'react';
import { TransactionList } from '@/components/TransactionList';
import { FilterBar, FilterDate, FilterSelect } from '@/components/ui/Field';
import { PageHeader, Pagination } from '@/components/ui/Parts';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';
import { useDebounced } from '@/hooks/useDebounced';
import { useCategories, useTransactions } from '@/services/queries';
import { dayEnd, dayStart } from '@/utils/date';

const SORTS = { newest: ['date', 'desc'], oldest: ['date', 'asc'], highest: ['amount', 'desc'], lowest: ['amount', 'asc'] } as const;

export default function TransactionsPage() {
  const [f, setF] = useState({ search: '', type: '', kind: '', category: '', from: '', to: '', sort: 'newest' as keyof typeof SORTS, page: 1 });
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const search = useDebounced(f.search);
  const cats = useCategories();
  const [sortBy, order] = SORTS[f.sort];
  const bad = !!f.from && !!f.to && f.from > f.to;
  const q = useTransactions({
    page: f.page, limit: 20, search: search || undefined, type: f.kind ? undefined : f.type || undefined, kind: f.kind || undefined, category: f.category || undefined,
    from: f.from && !bad ? dayStart(f.from).toISOString() : undefined, to: f.to && !bad ? dayEnd(f.to).toISOString() : undefined, sortBy, order,
  });
  const names = [...(cats.data?.defaults ?? []), ...(cats.data?.custom.map((c) => c.name) ?? []), 'Fees', 'Lending', 'Borrowing'];
  const filtered = !!(search || f.type || f.kind || f.category || f.from || f.to);
  return (
    <>
      <PageHeader title="Transactions" description="Every rupee in and out, in one place." />
      <FilterBar>
        <div className="relative min-w-[13rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" aria-label="Search transactions" placeholder="Search by title" value={f.search} onChange={(e) => set({ search: e.target.value })} className="h-10 w-full rounded-[10px] bg-fill pl-9 pr-3 text-[15px] placeholder:text-faint focus:outline-none focus:ring-[3px] focus:ring-accent/40" />
        </div>
        <FilterSelect label="Money in or out" value={f.type} onChange={(e) => set({ type: e.target.value, kind: '' })}><option value="">In and out</option><option value="income">Income only</option><option value="expense">Expenses only</option></FilterSelect>
        <FilterSelect label="Type" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
          <option value="">All types</option><option value="income">Income</option><option value="expense">Expense</option><option value="fee_payment">Fee payment</option><option value="lend_out">Lent</option><option value="lend_repayment">Repaid to you</option><option value="borrow_in">Borrowed</option><option value="borrow_repayment">You repaid</option>
        </FilterSelect>
        <FilterSelect label="Category" value={f.category} onChange={(e) => set({ category: e.target.value })}><option value="">All categories</option>{names.map((n) => <option key={n}>{n}</option>)}</FilterSelect>
        <FilterDate label="From date" value={f.from} onChange={(e) => set({ from: e.target.value })} />
        <FilterDate label="To date" value={f.to} onChange={(e) => set({ to: e.target.value })} />
        <FilterSelect label="Sort" value={f.sort} onChange={(e) => set({ sort: e.target.value as keyof typeof SORTS })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></FilterSelect>
      </FilterBar>
      {bad && <p role="alert" className="mb-3 text-[13px] text-danger">The start date must be on or before the end date.</p>}
      {q.isPending ? <ListSkeleton /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        : q.data.items.length ? <div className="overflow-hidden rounded-2xl bg-surface shadow-card"><TransactionList items={q.data.items} /></div>
        : <EmptyState title={filtered ? 'No transactions match' : 'No transactions yet'} description={filtered ? 'Try removing a filter or widening the dates.' : 'Add income or an expense and it will appear here.'} />}
      <Pagination meta={q.data?.meta} onPage={(page) => set({ page })} />
    </>
  );
}
