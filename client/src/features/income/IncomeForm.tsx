import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { AmountInput, Field, FormError, Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, serverFieldErrors } from '@/lib/api';
import { INCOME_SOURCES, PAYMENT_METHODS } from '@/lib/constants';
import { istDay, todayIST } from '@/lib/dates';
import { normalizeAmount, paiseToInput } from '@/lib/money';
import type { Income, IncomeSource } from '@/lib/types';
import { toast } from '@/store/toast';
import { amountRule } from '../expenses/ExpenseForm';
import { useSaveIncome } from './api';

const schema = z.object({
  source: z.enum(INCOME_SOURCES.map((s) => s.value) as [IncomeSource, ...IncomeSource[]]),
  amount: amountRule(),
  date: z.string().min(1, 'Pick a date'),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'debit_card', 'credit_card', 'other']),
  description: z.string().trim().max(500),
  notes: z.string().trim().max(1000),
});
type Values = z.infer<typeof schema>;

export function IncomeForm({ item, source, onDone }: { item?: Income; source?: IncomeSource; onDone: () => void }) {
  const save = useSaveIncome(item?.id);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { source: item.source, amount: paiseToInput(item.amountPaise), date: istDay(item.date), paymentMethod: item.paymentMethod, description: item.description ?? '', notes: item.notes ?? '' }
      : { source: source ?? 'parents', amount: '', date: todayIST(), paymentMethod: 'upi', description: '', notes: '' },
  });

  const submit = (v: Values) =>
    save.mutate(
      { source: v.source, amount: normalizeAmount(v.amount)!, date: v.date, paymentMethod: v.paymentMethod, ...(v.description && { description: v.description }), ...(v.notes && { notes: v.notes }) },
      {
        onSuccess: () => { toast.success(item ? 'Income updated' : 'Income added'); onDone(); },
        onError: (e) => serverFieldErrors(e, ['amount', 'date']).forEach((x) => setError(x.field as keyof Values, { message: x.message })),
      },
    );

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(submit)}>
      <FormError message={save.error instanceof ApiError && !save.error.details?.length ? save.error.message : null} />
      <Field label="Amount received" error={errors.amount?.message}>{(id) => <AmountInput id={id} autoFocus={!item} invalid={!!errors.amount} {...register('amount')} />}</Field>
      <Field label="Source">{(id) => <Select id={id} {...register('source')}>{INCOME_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date received" error={errors.date?.message}>{(id) => <Input id={id} type="date" max={todayIST()} {...register('date')} />}</Field>
        <Field label="Received via">{(id) => <Select id={id} {...register('paymentMethod')}>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>}</Field>
      </div>
      <Field label="Description" optional>{(id) => <Input id={id} placeholder="e.g. November allowance" {...register('description')} />}</Field>
      <Field label="Notes" optional>{(id) => <Textarea id={id} {...register('notes')} />}</Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={save.isPending}>{item ? 'Save changes' : 'Add income'}</Button>
      </div>
    </form>
  );
}
