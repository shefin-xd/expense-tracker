import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormActions } from '@/components/FormParts';
import { AmountInput, SelectInput, TextArea, TextInput } from '@/components/ui/Field';
import { api } from '@/services/api';
import { useSave } from '@/services/queries';
import { FEE_CATEGORIES, FEE_CATEGORY_LABELS, type Fee } from '@/types/api';
import { toDayKey, todayKey } from '@/utils/date';
import { formatINR, paiseToInput, rupeesToPaise } from '@/utils/money';
import { amountText, dayText, optionalText } from '@/utils/schemas';

/** "2026-27" for dates from June onward, "2025-26" before it (Indian academic year). */
export function defaultAcademicYear(day = todayKey()) {
  const [y, m] = day.split('-').map(Number) as [number, number];
  const start = m >= 6 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

const feeSchema = z.object({
  title: z.string().trim().min(1, 'Give this fee a name').max(150),
  category: z.enum(FEE_CATEGORIES),
  academicYear: z.string().trim().min(1, 'Enter the academic year').max(20),
  total: amountText,
  dueDate: dayText,
  notes: optionalText(1000),
});
type FeeValues = z.infer<typeof feeSchema>;

export function FeeForm({ fee, onDone }: { fee?: Fee; onDone: () => void }) {
  const { register, handleSubmit, setError, formState: { errors } } = useForm<FeeValues>({
    resolver: zodResolver(feeSchema),
    defaultValues: fee
      ? { title: fee.title, category: fee.category, academicYear: fee.academicYear, total: paiseToInput(fee.totalPaise), dueDate: toDayKey(fee.dueDate), notes: fee.notes ?? '' }
      : { title: '', category: 'tuition', academicYear: defaultAcademicYear(), total: '', dueDate: '', notes: '' },
  });
  const save = useSave(
    (v: FeeValues) => { const body = { ...v, notes: v.notes || undefined }; return fee ? api.patch(`/fees/${fee.id}`, body) : api.post('/fees', body); },
    fee ? 'Fee updated' : 'Fee added',
    onDone,
  );
  return (
    <form noValidate onSubmit={handleSubmit((v) => {
      if (fee && (rupeesToPaise(v.total) ?? 0) < fee.paidPaise) return setError('total', { message: `${formatINR(fee.paidPaise)} is already paid, so the total cannot be lower` });
      save.mutate(v);
    })} className="space-y-4">
      <TextInput label="Fee name" placeholder="e.g. Semester 2 tuition" autoFocus error={errors.title?.message} {...register('title')} />
      <SelectInput label="Type" error={errors.category?.message} {...register('category')}>{FEE_CATEGORIES.map((c) => <option key={c} value={c}>{FEE_CATEGORY_LABELS[c]}</option>)}</SelectInput>
      <div className="grid grid-cols-2 gap-3">
        <AmountInput label="Total amount due" error={errors.total?.message} {...register('total')} />
        <TextInput label="Due date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
      </div>
      <TextInput label="Academic year" error={errors.academicYear?.message} {...register('academicYear')} />
      <TextArea label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
      <p className="text-[13px] text-muted">Adding a fee does not change your balance. Only payments you record do.</p>
      <FormActions onCancel={onDone} busy={save.isPending} submitLabel={fee ? 'Save changes' : 'Add fee'} />
    </form>
  );
}

const paySchema = z.object({ amount: amountText, date: dayText, referenceNo: optionalText(80), notes: optionalText(500) });
type PayValues = z.infer<typeof paySchema>;

export function PaymentForm({ fee, onDone }: { fee: Fee; onDone: () => void }) {
  const { register, handleSubmit, setError, formState: { errors } } = useForm<PayValues>({
    resolver: zodResolver(paySchema),
    defaultValues: { amount: paiseToInput(fee.remainingPaise), date: todayKey(), referenceNo: '', notes: '' },
  });
  const save = useSave((v: PayValues) => api.post(`/fees/${fee.id}/payments`, { ...v, referenceNo: v.referenceNo || undefined, notes: v.notes || undefined }), 'Payment recorded', onDone);
  return (
    <form noValidate onSubmit={handleSubmit((v) => {
      if ((rupeesToPaise(v.amount) ?? 0) > fee.remainingPaise) return setError('amount', { message: `Only ${formatINR(fee.remainingPaise)} is left to pay` });
      save.mutate(v);
    })} className="space-y-4">
      <p className="text-sm text-muted">{fee.title}: {formatINR(fee.remainingPaise)} left of {formatINR(fee.totalPaise)}. This payment will reduce your balance.</p>
      <AmountInput label="Amount paid" autoFocus error={errors.amount?.message} {...register('amount')} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Payment date" type="date" error={errors.date?.message} {...register('date')} />
        <TextInput label="Reference no. (optional)" error={errors.referenceNo?.message} {...register('referenceNo')} />
      </div>
      <TextArea label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
      <FormActions onCancel={onDone} busy={save.isPending} submitLabel="Record payment" />
    </form>
  );
}
