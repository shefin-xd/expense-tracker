import { Search, X } from 'lucide-react';
import { Input, Select } from '@/components/ui/form';

export function SearchBox({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative min-w-0 flex-1 basis-48">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
      <Input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="pl-9 pr-8" />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-fg"><X className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
}

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (r: { from: string; to: string }) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} className="w-[9.5rem]" />
      <span className="text-sm text-faint" aria-hidden>to</span>
      <Input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} className="w-[9.5rem]" />
    </div>
  );
}

export type SortKey = 'date:desc' | 'date:asc' | 'amount:desc' | 'amount:asc';
export const parseSort = (s: SortKey) => { const [sortBy, order] = s.split(':') as ['date' | 'amount', 'asc' | 'desc']; return { sortBy, order }; };
export function SortSelect({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  return (
    <Select aria-label="Sort by" value={value} onChange={(e) => onChange(e.target.value as SortKey)} className="w-auto">
      <option value="date:desc">Newest first</option>
      <option value="date:asc">Oldest first</option>
      <option value="amount:desc">Highest amount</option>
      <option value="amount:asc">Lowest amount</option>
    </Select>
  );
}
