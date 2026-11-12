import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormActions } from '@/components/FormParts';
import { AmountInput, TextArea, TextInput } from '@/components/ui/Field';
import { api } from '@/services/api';
import { useSave, type Direction } from '@/services/queries';
import type { Loan } from '@/types/api';
import { toDayKey, todayKey } from '@/utils/date';
import { formatINR, paiseToInput, rupeesToPaise } from '@/utils/money';
import { amountText, dayText, optionalText } from '@/utils/schemas';

const schema = z.object({
  person: z.string().trim().min(1, "Enter your friend's name").max(100),
  amount: amountText,
  date: dayText,
  expectedDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a valid date'),
  notes: optionalText(1000),
});
type Values = z.infer<typeof schema>;

export function LoanForm({ direction, loan, onDone }: { direction: Direction; loan?: Loan; onDone: () => void }) {
  const lent = direction === 'lending';
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: loan
      ? { person: loan.person, amount: paiseToInput(loan.amountPaise), date: toDayKey(loan.date), expectedDate: loan.expectedDate ? toDayKey(loan.expectedDate) : '', notes: loan.notes ?? '' }
      : { person: '', amount: '', date: todayKey(), expectedDate: '', notes: '' },
  });
  const save = useSave(
    (v: Values) => { const body = { ...v, expectedDate: v.expectedDate || undefined, notes: v.notes || undefined }; return loan ? api.patch(`/${direction}/${loan.id}`, body) : api.post(`/${direction}`, body); },
    loan ? 'Updated' : lent ? 'Loan recorded' : 'Borrowing recorded',
    onDone,
  );
  return (
    <form noValidate onSubmit={handleSubmit((v) => {
      if (loan && (rupeesToPaise(v.amount) ?? 0) < loan.repaidPaise) return setError('amount', { message: `${formatINR(loan.repaidPaise)} is already settled, so the amount cannot be lower` });
      save.mutate(v);
    })} className="space-y-4">
      <TextInput label={lent ? 'Lent to' : 'Borrowed from'} autoFocus autoComplete="off" error={errors.person?.message} {...register('person')} />
      <AmountInput label="Amount" error={errors.amount?.message} {...register('amount')} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Date" type="date" error={errors.date?.message} {...register('date')} />
        <TextInput label="Expected repayment (optional)" type="date" error={errors.expectedDate?.message} {...register('expectedDate')} />
      </div>
      <TextArea label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
      <p className="text-[13px] text-muted">{lent ? 'This amount leaves your balance now and returns when your friend pays you back.' : 'This adds cash to your balance, but it is a debt, not income.'}</p>
      <FormActions onCancel={onDone} busy={save.isPending} submitLabel={loan ? 'Save changes' : lent ? 'Record loan' : 'Record borrowing'} />
    </form>
  );
}

const repaySchema = z.object({ amount: amountText, date: dayText, notes: optionalText(300) });
type RepayValues = z.infer<typeof repaySchema>;

export function RepaymentForm({ direction, loan, onDone }: { direction: Direction; loan: Loan; onDone: () => void }) {
  const lent = direction === 'lending';
  const { register, handleSubmit, setError, formState: { errors } } = useForm<RepayValues>({
    resolver: zodResolver(repaySchema),
    defaultValues: { amount: paiseToInput(loan.remainingPaise), date: todayKey(), notes: '' },
  });
  const save = useSave((v: RepayValues) => api.post(`/${direction}/${loan.id}/repayments`, { ...v, notes: v.notes || undefined }), 'Repayment recorded', onDone);
  return (
    <form noValidate onSubmit={handleSubmit((v) => {
      if ((rupeesToPaise(v.amount) ?? 0) > loan.remainingPaise) return setError('amount', { message: `Only ${formatINR(loan.remainingPaise)} is left` });
      save.mutate(v);
    })} className="space-y-4">
      <p className="text-sm text-muted">{lent ? `${loan.person} still owes you` : `You still owe ${loan.person}`} {formatINR(loan.remainingPaise)}.</p>
      <AmountInput label={lent ? 'Amount received back' : 'Amount repaid'} autoFocus error={errors.amount?.message} {...register('amount')} />
      <TextInput label="Date" type="date" error={errors.date?.message} {...register('date')} />
      <TextInput label="Note (optional)" error={errors.notes?.message} {...register('notes')} />
      <FormActions onCancel={onDone} busy={save.isPending} submitLabel="Record repayment" />
    </form>
  );
}
