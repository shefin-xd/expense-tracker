import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { DateRange, parseSort, SearchBox, SortSelect, type SortKey } from '@/components/filters';
import { TransactionRow } from '@/components/TransactionRow';
import { Button } from '@/components/ui/Button';
import { Money, PageHeader, Pagination, Section, Stat } from '@/components/ui/display';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/form';
import { useDebounced } from '@/hooks/useDebounced';
import { api } from '@/lib/api';
import { KIND_LABEL } from '@/lib/constants';
import { istEnd, istStart } from '@/lib/dates';
import type { LedgerEntry, LedgerKind } from '@/lib/types';
import { useUi } from '@/store/ui';
import { useCategories } from '../expenses/api';

interface Summary { balancePaise: number; totalIncomePaise: number; totalExpensesPaise: number }

export default function TransactionsPage() {
  const openQuick = useUi((s) => s.openQuick);
  const cats = useCategories();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'' | LedgerKind>('');
  const [category, setCategory] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [sort, setSort] = useState<SortKey>('date:desc');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const params = {
    ...parseSort(sort), search: q || undefined, kind: kind || undefined, category: category || undefined,
    from: range.from ? istStart(range.from) : undefined, to: range.to ? istEnd(range.to) : undefined,
  };
  const list = useQuery({ queryKey: ['transactions', page, params], queryFn: () => api.list<LedgerEntry>('/transactions', { ...params, page, limit: 25 }), placeholderData: (p) => p });
  const sum = useQuery({ queryKey: ['transactions', 'summary', params.from, params.to], queryFn: () => api.get<Summary>('/transactions/summary', { from: params.from, to: params.to }) });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const filtered = !!(search || kind || category || range.from || range.to);
  const allCats = [...(cats.data?.defaults ?? []), ...(cats.data?.custom.map((c) => c.name) ?? [])];

  return (
    <>
      <PageHeader title="Transactions" description="Every rupee in and out, in one list." actions={<Button onClick={() => openQuick({ type: 'expense' })}><Plus className="h-4 w-4" />Add</Button>} />

      <Section className="mb-6">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Money in" value={sum.data ? <Money paise={sum.data.totalIncomePaise} /> : '—'} />
          <Stat label="Money out" value={sum.data ? <Money paise={sum.data.totalExpensesPaise} /> : '—'} />
          <Stat label={range.from || range.to ? 'Net change' : 'Balance'} value={sum.data ? <Money paise={sum.data.balancePaise} sign={!!(range.from || range.to)} /> : '—'} />
        </div>
        <p className="mt-3 text-xs text-muted">These totals follow the date range only. Money out is expenses plus fee payments. Loans and repayments move your balance but aren’t income or spending.</p>
      </Section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search transactions" />
        <Select aria-label="Type" value={kind} onChange={(e) => reset(setKind)(e.target.value as '' | LedgerKind)} className="w-auto">
          <option value="">All types</option>{(Object.keys(KIND_LABEL) as LedgerKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </Select>
        <Select aria-label="Category" value={category} onChange={(e) => reset(setCategory)(e.target.value)} className="w-auto"><option value="">All categories</option>{allCats.map((c) => <option key={c}>{c}</option>)}</Select>
        <DateRange {...range} onChange={reset(setRange)} />
        <SortSelect value={sort} onChange={reset(setSort)} />
      </div>

      <Section flush>
        {list.isPending ? <div className="px-4"><ListSkeleton /></div>
          : list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          : list.data.items.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title={filtered ? 'No transactions match these filters' : 'No transactions yet'}
              description={filtered ? 'Try clearing a filter.' : 'Add an expense or record money you received to get started.'} />
          ) : (
            <>
              <ul className="divide-y divide-line">{list.data.items.map((t) => <TransactionRow key={t.id} t={t} />)}</ul>
              <Pagination meta={list.data.meta} onPage={setPage} />
            </>
          )}
      </Section>
    </>
  );
}
