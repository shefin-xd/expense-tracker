import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormActions } from '@/components/FormParts';
import { AmountInput, SelectInput, TextArea, TextInput, Toggle } from '@/components/ui/Field';
import { api } from '@/services/api';
import { useCategories, useSave } from '@/services/queries';
import { INCOME_SOURCES, INCOME_SOURCE_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type RecurringItem } from '@/types/api';
import { todayKey } from '@/utils/date';
import { formatINR, paiseToInput } from '@/utils/money';
import { amountText, dayText, optionalText } from '@/utils/schemas';

const schema = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(100),
  amount: amountText,
  dayOfMonth: z.string().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 28, 'Choose a day from 1 to 28'),
  target: z.string().min(1, 'Choose one'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: optionalText(500),
  active: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** Create or edit a monthly item. It never records anything by itself: you confirm it each month. */
export function RecurringForm({ kind, item, onDone }: { kind: 'income' | 'expense'; item?: RecurringItem; onDone: () => void }) {
  const cats = useCategories();
  const names = [...(cats.data?.defaults ?? []), ...(cats.data?.custom.map((c) => c.name) ?? [])];
  const { register, control, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { name: item.name, amount: paiseToInput(item.amountPaise), dayOfMonth: String(item.dayOfMonth), target: (kind === 'income' ? item.source : item.category) ?? '', paymentMethod: item.paymentMethod, notes: item.notes ?? '', active: item.active }
      : { name: kind === 'income' ? 'Monthly allowance' : '', amount: '', dayOfMonth: '1', target: kind === 'income' ? 'parents' : 'Mess', paymentMethod: 'upi', notes: '', active: true },
  });
  const save = useSave(
    (v: Values) => {
      const body = { kind, name: v.name, amount: v.amount, dayOfMonth: Number(v.dayOfMonth), paymentMethod: v.paymentMethod, active: v.active, ...(v.notes ? { notes: v.notes } : {}), ...(kind === 'income' ? { source: v.target } : { category: v.target }) };
      return item ? api.patch(`/recurring/${item.id}`, body) : api.post('/recurring', body);
    },
    item ? 'Updated' : 'Monthly item added',
    onDone,
  );
  return (
    <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
      <TextInput label="Name" autoFocus error={errors.name?.message} {...register('name')} />
      <div className="grid grid-cols-2 gap-3">
        <AmountInput label="Usual amount" error={errors.amount?.message} {...register('amount')} />
        <SelectInput label="Day of the month" error={errors.dayOfMonth?.message} {...register('dayOfMonth')}>{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</SelectInput>
      </div>
      {kind === 'income'
        ? <SelectInput label="Comes from" error={errors.target?.message} {...register('target')}>{INCOME_SOURCES.map((s) => <option key={s} value={s}>{INCOME_SOURCE_LABELS[s]}</option>)}</SelectInput>
        : <SelectInput label="Category" error={errors.target?.message} {...register('target')}>{names.map((n) => <option key={n}>{n}</option>)}</SelectInput>}
      <SelectInput label={kind === 'income' ? 'Received by' : 'Paid with'} error={errors.paymentMethod?.message} {...register('paymentMethod')}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</SelectInput>
      <TextArea label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
      {item && <Controller control={control} name="active" render={({ field }) => <Toggle label="Active" description="Paused items never come due" checked={field.value} onChange={field.onChange} />} />}
      <p className="px-1 text-[13px] text-muted">Nothing is recorded automatically. When the day arrives you will be asked to confirm it, and you can change the amount first.</p>
      <FormActions onCancel={onDone} busy={save.isPending} submitLabel={item ? 'Save changes' : 'Add'} />
    </form>
  );
}

const confirmSchema = z.object({ amount: amountText, date: dayText });
type ConfirmValues = z.infer<typeof confirmSchema>;

export function ConfirmRecurringForm({ item, onDone }: { item: RecurringItem; onDone: () => void }) {
  const income = item.kind === 'income';
  const { register, handleSubmit, formState: { errors } } = useForm<ConfirmValues>({ resolver: zodResolver(confirmSchema), defaultValues: { amount: paiseToInput(item.amountPaise), date: todayKey() } });
  const save = useSave((v: ConfirmValues) => api.post(`/recurring/${item.id}/confirm`, { amount: v.amount, date: v.date }), income ? 'Money recorded' : 'Payment recorded', onDone);
  return (
    <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
      <p className="px-1 text-[15px] text-muted">{item.name}: usually {formatINR(item.amountPaise)}. {income ? 'Confirm what you actually received.' : 'Confirm what you actually paid.'} This {income ? 'adds to' : 'reduces'} your balance.</p>
      <AmountInput label={income ? 'Amount received' : 'Amount paid'} autoFocus error={errors.amount?.message} {...register('amount')} />
      <TextInput label="Date" type="date" error={errors.date?.message} {...register('date')} />
      <FormActions onCancel={onDone} busy={save.isPending} submitLabel={income ? 'Record money' : 'Record payment'} />
    </form>
  );
}
