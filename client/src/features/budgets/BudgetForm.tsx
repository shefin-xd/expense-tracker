import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { AmountInput, Field, FormError, Select } from '@/components/ui/form';
import { ApiError } from '@/lib/api';
import { normalizeAmount, paiseToInput } from '@/lib/money';
import type { BudgetProgress } from '@/lib/types';
import { toast } from '@/store/toast';
import { useCategories } from '../expenses/api';
import { useSaveBudget } from './api';

interface Row { category: string; limit: string }

export function BudgetForm({ month, current, onDone }: { month: string; current?: BudgetProgress; onDone: () => void }) {
  const cats = useCategories();
  const save = useSaveBudget(month);
  const names = [...(cats.data?.defaults ?? []), ...(cats.data?.custom.map((c) => c.name) ?? [])];
  const [overall, setOverall] = useState(current?.overall ? paiseToInput(current.overall.limitPaise) : '');
  const [rows, setRows] = useState<Row[]>(current?.categories.map((c) => ({ category: c.category, limit: paiseToInput(c.limitPaise) })) ?? []);
  const [error, setError] = useState<string | null>(null);

  const used = new Set(rows.map((r) => r.category));
  const free = names.filter((n) => !used.has(n));
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const o = overall.trim() ? normalizeAmount(overall) : undefined;
    if (o === null) return setError('Enter the monthly limit like 5000 or 5000.50.');
    const cs: { category: string; limit: string }[] = [];
    for (const r of rows) {
      const l = normalizeAmount(r.limit);
      if (!l) return setError(`Enter a limit for ${r.category}.`);
      cs.push({ category: r.category, limit: l });
    }
    if (o === undefined && cs.length === 0) return setError('Set an overall limit or at least one category limit.');
    save.mutate({ ...(o && { overall: o }), categories: cs }, {
      onSuccess: () => { toast.success('Budget saved'); onDone(); },
      onError: (err) => setError(err instanceof ApiError ? (err.details?.[0]?.message ?? err.message) : 'Couldn’t save. Try again.'),
    });
  };

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <FormError message={error} />
      <Field label="Overall monthly limit" optional hint="The most you want to spend in total this month.">
        {(id) => <AmountInput id={id} autoFocus value={overall} onChange={(e) => setOverall(e.target.value)} />}
      </Field>
      <div>
        <h3 className="mb-2 text-[13px] font-medium">Category limits</h3>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.category} className="flex items-center gap-2">
              <Select aria-label="Category" value={r.category} onChange={(e) => setRow(i, { category: e.target.value })} className="flex-1">
                {[r.category, ...free].map((n) => <option key={n}>{n}</option>)}
              </Select>
              <div className="w-32"><AmountInput aria-label={`${r.category} limit`} value={r.limit} onChange={(e) => setRow(i, { limit: e.target.value })} /></div>
              <IconButton label={`Remove ${r.category}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></IconButton>
            </div>
          ))}
        </div>
        {free.length > 0 && <Button variant="ghost" size="sm" className="mt-2" onClick={() => setRows((rs) => [...rs, { category: free[0]!, limit: '' }])}><Plus className="h-4 w-4" />Add category limit</Button>}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={save.isPending}>Save budget</Button>
      </div>
    </form>
  );
}
