import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormActions } from '@/components/FormParts';
import { AmountInput, SelectInput, TextArea, TextInput } from '@/components/ui/Field';
import { api } from '@/services/api';
import { useCategories, useSave } from '@/services/queries';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type Expense } from '@/types/api';
import { toDayKey, todayKey } from '@/utils/date';
import { paiseToInput } from '@/utils/money';
import { amountText, dayText, optionalText } from '@/utils/schemas';

const schema = z.object({
  amount: amountText,
  title: z.string().trim().max(150),
  category: z.string().min(1, 'Choose a category'),
  date: dayText,
  paymentMethod: z.enum(PAYMENT_METHODS),
  description: optionalText(500),
  notes: optionalText(1000),
});
type Values = z.infer<typeof schema>;

const LAST_KEY = 'cl-last-expense';
const remembered = (): { category?: string; paymentMethod?: Values['paymentMethod'] } => { try { return JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}'); } catch { return {}; } };

/** Add or edit an expense. Quick mode (used by the Add button) keeps it to amount, category and what it was for. */
export function ExpenseForm({ expense, onDone, quick }: { expense?: Expense; onDone: () => void; quick?: boolean }) {
  const cats = useCategories();
  const all = [...(cats.data?.defaults ?? []), ...(cats.data?.custom.map((c) => c.name) ?? [])];
  const last = remembered();
  const [more, setMore] = useState(!quick);
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: expense
      ? { amount: paiseToInput(expense.amountPaise), title: expense.title, category: expense.category, date: toDayKey(expense.date), paymentMethod: expense.paymentMethod, description: expense.description ?? '', notes: expense.notes ?? '' }
      : { amount: '', title: '', category: last.category ?? 'Food', date: todayKey(), paymentMethod: last.paymentMethod ?? 'upi', description: '', notes: '' },
  });
  const category = watch('category');
  const save = useSave(
    (v: Values) => {
      const body = { ...v, title: v.title.trim() || v.category, description: v.description || undefined, notes: v.notes || undefined };
      return expense ? api.patch(`/expenses/${expense.id}`, body) : api.post('/expenses', body);
    },
    expense ? 'Expense updated' : 'Expense added',
    onDone,
  );
  return (
    <form noValidate onSubmit={handleSubmit((v) => { localStorage.setItem(LAST_KEY, JSON.stringify({ category: v.category, paymentMethod: v.paymentMethod })); save.mutate(v); })} className="space-y-4">
      <AmountInput label="Amount" autoFocus error={errors.amount?.message} {...register('amount')} />
      <div>
        <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">Category</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
          {(all.length ? all : ['Food']).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={category === c} onClick={() => setValue('category', c, { shouldValidate: true })}
              className={clsx('h-9 rounded-full px-3.5 text-[14px] font-medium transition-colors active:opacity-70', category === c ? 'bg-accent text-white' : 'bg-fill text-text')}>{c}</button>
          ))}
        </div>
        {errors.category && <p role="alert" className="mt-1.5 text-[13px] text-danger">{errors.category.message}</p>}
      </div>
      <TextInput label="What was it for?" placeholder="Optional. Defaults to the category" error={errors.title?.message} {...register('title')} />
      {!more && <button type="button" onClick={() => setMore(true)} className="text-[13px] font-medium text-accent underline underline-offset-4">Date, payment method and notes</button>}
      {more && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Date" type="date" error={errors.date?.message} {...register('date')} />
            <SelectInput label="Paid with" error={errors.paymentMethod?.message} {...register('paymentMethod')}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</SelectInput>
          </div>
          <TextInput label="Description (optional)" error={errors.description?.message} {...register('description')} />
          <TextArea label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
        </>
      )}
      <FormActions onCancel={onDone} busy={save.isPending} submitLabel={expense ? 'Save changes' : 'Add expense'} />
    </form>
  );
}
