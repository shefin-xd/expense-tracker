import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { AmountInput, Field, FormError, Input, Select, Textarea } from '@/components/ui/form';
import { PAYMENT_METHODS } from '@/lib/constants';
import { ApiError, serverFieldErrors } from '@/lib/api';
import { istDay, todayIST } from '@/lib/dates';
import { normalizeAmount, paiseToInput } from '@/lib/money';
import { toast } from '@/store/toast';
import { useUi } from '@/store/ui';
import type { Expense } from '@/lib/types';
import { useCategories, useSaveExpense } from './api';

export const amountRule = (label = 'amount') =>
  z.string().refine((v) => normalizeAmount(v) !== null, `Enter a ${label} like 250 or 250.50`);

const schema = z.object({
  amount: amountRule(),
  title: z.string().trim().min(1, 'Add a title').max(150),
  category: z.string().min(1, 'Pick a category'),
  date: z.string().min(1, 'Pick a date'),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'debit_card', 'credit_card', 'other']),
  description: z.string().trim().max(500),
  notes: z.string().trim().max(1000),
  receiptUrl: z.string().trim().max(500).refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), 'Enter a full link starting with https://'),
});
type Values = z.infer<typeof schema>;

export function ExpenseForm({ item, onDone }: { item?: Expense; onDone: () => void }) {
  const { lastCategory, lastMethod, remember } = useUi();
  const cats = useCategories();
  const save = useSaveExpense(item?.id);
  const [more, setMore] = useState(!!item && !!(item.description || item.notes || item.receiptUrl));
  const names = [...(cats.data?.defaults ?? []), ...(cats.data?.custom.map((c) => c.name) ?? [])];
  // Make sure the item's own category is selectable even if the list hasn't loaded yet.
  const options = item && !names.includes(item.category) ? [item.category, ...names] : names;

  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { amount: paiseToInput(item.amountPaise), title: item.title, category: item.category, date: istDay(item.date), paymentMethod: item.paymentMethod,
          description: item.description ?? '', notes: item.notes ?? '', receiptUrl: item.receiptUrl ?? '' }
      : { amount: '', title: '', category: lastCategory, date: todayIST(), paymentMethod: lastMethod, description: '', notes: '', receiptUrl: '' },
  });

  const submit = (v: Values) => {
    save.mutate(
      { title: v.title, amount: normalizeAmount(v.amount)!, category: v.category, date: v.date, paymentMethod: v.paymentMethod,
        ...(v.description && { description: v.description }), ...(v.notes && { notes: v.notes }), ...(v.receiptUrl && { receiptUrl: v.receiptUrl }) },
      {
        onSuccess: () => { remember({ category: v.category, method: v.paymentMethod }); toast.success(item ? 'Expense updated' : 'Expense added'); onDone(); },
        onError: (e) => serverFieldErrors(e, ['amount', 'title', 'category', 'date']).forEach((x) => setError(x.field as keyof Values, { message: x.message })),
      },
    );
  };

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(submit)}>
      <FormError message={save.error instanceof ApiError && !save.error.details?.length ? save.error.message : null} />
      <Field label="Amount" error={errors.amount?.message}>{(id) => <AmountInput id={id} autoFocus={!item} invalid={!!errors.amount} {...register('amount')} />}</Field>
      <Field label="Title" error={errors.title?.message}>{(id) => <Input id={id} placeholder="e.g. Lunch at canteen" invalid={!!errors.title} {...register('title')} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" error={errors.category?.message}>{(id) => <Select id={id} {...register('category')}>{options.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
        <Field label="Paid with">{(id) => <Select id={id} {...register('paymentMethod')}>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>}</Field>
      </div>
      <Field label="Date" error={errors.date?.message}>{(id) => <Input id={id} type="date" max={todayIST()} {...register('date')} />}</Field>
      {more ? (
        <>
          <Field label="Description" optional>{(id) => <Input id={id} {...register('description')} />}</Field>
          <Field label="Notes" optional>{(id) => <Textarea id={id} {...register('notes')} />}</Field>
          <Field label="Receipt link" optional hint="Paste a link to a photo or file stored elsewhere." error={errors.receiptUrl?.message}>{(id) => <Input id={id} type="url" inputMode="url" placeholder="https://" {...register('receiptUrl')} />}</Field>
        </>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="text-sm font-medium text-accent hover:underline">Add description, notes or receipt</button>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={save.isPending}>{item ? 'Save changes' : 'Add expense'}</Button>
      </div>
    </form>
  );
}
