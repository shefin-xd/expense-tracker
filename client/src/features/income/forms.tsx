import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormActions } from '@/components/FormParts';
import { AmountInput, SelectInput, TextArea, TextInput } from '@/components/ui/Field';
import { api } from '@/services/api';
import { useSave } from '@/services/queries';
import { INCOME_SOURCES, INCOME_SOURCE_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type Income, type IncomeSource } from '@/types/api';
import { toDayKey, todayKey } from '@/utils/date';
import { paiseToInput } from '@/utils/money';
import { amountText, dayText, optionalText } from '@/utils/schemas';

const schema = z.object({ source: z.enum(INCOME_SOURCES), amount: amountText, date: dayText, description: optionalText(500), paymentMethod: z.enum(PAYMENT_METHODS), notes: optionalText(1000) });
type Values = z.infer<typeof schema>;

export function IncomeForm({ income, presetSource, onDone }: { income?: Income; presetSource?: IncomeSource; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: income
      ? { source: income.source, amount: paiseToInput(income.amountPaise), date: toDayKey(income.date), description: income.description ?? '', paymentMethod: income.paymentMethod, notes: income.notes ?? '' }
      : { source: presetSource ?? 'parents', amount: '', date: todayKey(), description: '', paymentMethod: 'upi', notes: '' },
  });
  const save = useSave(
    (v: Values) => { const body = { ...v, description: v.description || undefined, notes: v.notes || undefined }; return income ? api.patch(`/income/${income.id}`, body) : api.post('/income', body); },
    income ? 'Income updated' : 'Income added',
    onDone,
  );
  return (
    <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
      <SelectInput label="Received from" error={errors.source?.message} {...register('source')}>{INCOME_SOURCES.map((s) => <option key={s} value={s}>{INCOME_SOURCE_LABELS[s]}</option>)}</SelectInput>
      <AmountInput label="Amount" autoFocus error={errors.amount?.message} {...register('amount')} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Date received" type="date" error={errors.date?.message} {...register('date')} />
        <SelectInput label="Received by" error={errors.paymentMethod?.message} {...register('paymentMethod')}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</SelectInput>
      </div>
      <TextInput label="Description (optional)" error={errors.description?.message} {...register('description')} />
      <TextArea label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
      <FormActions onCancel={onDone} busy={save.isPending} submitLabel={income ? 'Save changes' : 'Add income'} />
    </form>
  );
}
