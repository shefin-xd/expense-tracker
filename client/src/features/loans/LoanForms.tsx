import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/display';
import { AmountInput, Field, FormError, Input, Textarea } from '@/components/ui/form';
import { ApiError } from '@/lib/api';
import { istDay, todayIST } from '@/lib/dates';
import { normalizeAmount, paiseToInput } from '@/lib/money';
import type { Loan, LoanDirection } from '@/lib/types';
import { toast } from '@/store/toast';
import { amountRule } from '../expenses/ExpenseForm';
import { useAddRepayment, useSaveLoan } from './api';

const schema = z.object({
  person: z.string().trim().min(1, 'Enter a name').max(100),
  amount: amountRule(),
  date: z.string().min(1, 'Pick a date'),
  expectedDate: z.string(),
  notes: z.string().trim().max(1000),
});
type Values = z.infer<typeof schema>;

export function LoanForm({ direction, item, onDone }: { direction: LoanDirection; item?: Loan; onDone: () => void }) {
  const lent = direction === 'lent';
  const save = useSaveLoan(direction, item?.id);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { person: item.person, amount: paiseToInput(item.amountPaise), date: istDay(item.date), expectedDate: item.expectedDate ? istDay(item.expectedDate) : '', notes: item.notes ?? '' }
      : { person: '', amount: '', date: todayIST(), expectedDate: '', notes: '' },
  });
  const submit = (v: Values) =>
    save.mutate(
      { person: v.person, amount: normalizeAmount(v.amount)!, date: v.date, ...(v.expectedDate && { expectedDate: v.expectedDate }), ...(v.notes && { notes: v.notes }) },
      { onSuccess: () => { toast.success(item ? 'Updated' : lent ? 'Lending recorded' : 'Borrowing recorded'); onDone(); } },
    );
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(submit)}>
      <FormError message={save.error instanceof ApiError ? save.error.message : null} />
      <Field label={lent ? 'Lent to' : 'Borrowed from'} error={errors.person?.message}>{(id) => <Input id={id} autoFocus={!item} placeholder="Friend’s name" invalid={!!errors.person} {...register('person')} />}</Field>
      <Field label="Amount" error={errors.amount?.message}>{(id) => <AmountInput id={id} invalid={!!errors.amount} {...register('amount')} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" error={errors.date?.message}>{(id) => <Input id={id} type="date" max={todayIST()} {...register('date')} />}</Field>
        <Field label="Expected back by" optional>{(id) => <Input id={id} type="date" {...register('expectedDate')} />}</Field>
      </div>
      <Field label="Notes" optional>{(id) => <Textarea id={id} {...register('notes')} />}</Field>
      <p className="text-xs text-muted">
        {lent ? 'Money you lend leaves your balance now and comes back when your friend repays.'
          : 'Borrowed money adds to your cash, but it’s a debt, not income. Repaying it isn’t counted as spending.'}
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={save.isPending}>{item ? 'Save changes' : lent ? 'Record lending' : 'Record borrowing'}</Button>
      </div>
    </form>
  );
}

const repaySchema = z.object({ amount: amountRule(), date: z.string().min(1, 'Pick a date'), notes: z.string().trim().max(300) });
type RepayValues = z.infer<typeof repaySchema>;

export function RepaymentForm({ direction, loan, onDone }: { direction: LoanDirection; loan: Loan; onDone: () => void }) {
  const add = useAddRepayment(direction, loan.id);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<RepayValues>({
    resolver: zodResolver(repaySchema),
    defaultValues: { amount: paiseToInput(loan.remainingPaise), date: todayIST(), notes: '' },
  });
  const submit = (v: RepayValues) =>
    add.mutate({ amount: normalizeAmount(v.amount)!, date: v.date, ...(v.notes && { notes: v.notes }) }, {
      onSuccess: () => { toast.success(direction === 'lent' ? 'Repayment received' : 'Repayment recorded'); onDone(); },
      onError: (e) => setError('amount', { message: e instanceof ApiError ? e.message : 'Couldn’t record this. Try again.' }),
    });
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(submit)}>
      <p className="text-sm text-muted">{loan.person} · <Money paise={loan.remainingPaise} /> {direction === 'lent' ? 'still owed to you' : 'still owed by you'}.</p>
      <Field label={direction === 'lent' ? 'Amount received back' : 'Amount repaid'} error={errors.amount?.message}>{(id) => <AmountInput id={id} autoFocus invalid={!!errors.amount} {...register('amount')} />}</Field>
      <Field label="Date" error={errors.date?.message}>{(id) => <Input id={id} type="date" max={todayIST()} {...register('date')} />}</Field>
      <Field label="Notes" optional>{(id) => <Input id={id} {...register('notes')} />}</Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={add.isPending}>Record</Button>
      </div>
    </form>
  );
}
