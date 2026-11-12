import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormActions } from '@/components/FormParts';
import { Button, IconButton } from '@/components/ui/Button';
import { AmountInput, SelectInput } from '@/components/ui/Field';
import { api } from '@/services/api';
import { useCategories, useSave } from '@/services/queries';
import type { BudgetProgress } from '@/types/api';
import { formatMonth } from '@/utils/date';
import { paiseToInput } from '@/utils/money';
import { amountText, amountTextOrZero } from '@/utils/schemas';

const schema = z.object({
  overall: amountTextOrZero,
  categories: z.array(z.object({ category: z.string().min(1, 'Choose a category'), limit: amountText })),
}).superRefine((v, ctx) => {
  if (v.overall === '' && v.categories.length === 0) ctx.addIssue({ code: 'custom', path: ['overall'], message: 'Set an overall limit or add a category limit' });
  const seen = new Set<string>();
  v.categories.forEach((c, i) => { if (seen.has(c.category)) ctx.addIssue({ code: 'custom', path: ['categories', i, 'category'], message: 'Already in this budget' }); seen.add(c.category); });
});
type Values = z.infer<typeof schema>;

export function BudgetForm({ month, current, onDone }: { month: string; current: BudgetProgress | undefined; onDone: () => void }) {
  const cats = useCategories();
  const names = [...(cats.data?.defaults ?? []), ...(cats.data?.custom.map((c) => c.name) ?? [])];
  const { register, control, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { overall: current?.overall ? paiseToInput(current.overall.limitPaise) : '', categories: (current?.categories ?? []).map((c) => ({ category: c.category, limit: paiseToInput(c.limitPaise) })) },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'categories' });
  const save = useSave(
    (v: Values) => api.put(`/budgets/${month}`, { ...(v.overall ? { overall: v.overall } : {}), categories: v.categories }),
    'Budget saved',
    onDone,
  );
  return (
    <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
      <p className="text-sm text-muted">Limits for {formatMonth(month)}. You will see a warning when you reach 80%.</p>
      <AmountInput label="Overall monthly limit" autoFocus error={errors.overall?.message} {...register('overall')} />
      <div className="space-y-3">
        <span className="block text-[13px] font-medium">Category limits</span>
        {fields.map((f, i) => (
          <div key={f.id} className="flex items-start gap-2">
            <SelectInput label="Category" wrapperClassName="flex-1" error={errors.categories?.[i]?.category?.message} {...register(`categories.${i}.category`)}>
              <option value="">Choose…</option>{names.map((n) => <option key={n}>{n}</option>)}
            </SelectInput>
            <AmountInput label="Limit" wrapperClassName="w-32" error={errors.categories?.[i]?.limit?.message} {...register(`categories.${i}.limit`)} />
            <IconButton label={`Remove category limit ${i + 1}`} className="mt-7" onClick={() => remove(i)}><Trash2 className="size-4" /></IconButton>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => append({ category: '', limit: '' })}><Plus className="size-4" aria-hidden />Add category limit</Button>
      </div>
      <FormActions onCancel={onDone} busy={save.isPending} submitLabel="Save budget" />
    </form>
  );
}
