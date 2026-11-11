import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/display";
import { AmountInput, Field, FormError, Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, serverFieldErrors } from '@/lib/api';
import { FEE_CATEGORIES } from '@/lib/constants';
import { academicYearOf, istDay, todayIST } from '@/lib/dates';
import { normalizeAmount, paiseToInput } from '@/lib/money';
import type { Fee, FeeCategory } from '@/lib/types';
import { toast } from '@/store/toast';
import { amountRule } from '../expenses/ExpenseForm';
import { useAddPayment, useSaveFee } from './api';

const schema = z.object({
  title: z.string().trim().min(1, 'Add a title').max(150),
  category: z.enum(FEE_CATEGORIES.map((c) => c.value) as [FeeCategory, ...FeeCategory[]]),
  academicYear: z.string().trim().min(1, 'Enter the academic year').max(20),
  total: amountRule('total'),
  dueDate: z.string().min(1, 'Pick a due date'),
  notes: z.string().trim().max(1000),
});
type Values = z.infer<typeof schema>;

export function FeeForm({ item, onDone }: { item?: Fee; onDone: () => void }) {
  const save = useSaveFee(item?.id);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { title: item.title, category: item.category, academicYear: item.academicYear, total: paiseToInput(item.totalPaise), dueDate: istDay(item.dueDate), notes: item.notes ?? '' }
      : { title: '', category: 'tuition', academicYear: academicYearOf(), total: '', dueDate: '', notes: '' },
  });
  const submit = (v: Values) =>
    save.mutate(
      { title: v.title, category: v.category, academicYear: v.academicYear, total: normalizeAmount(v.total)!, dueDate: v.dueDate, ...(v.notes && { notes: v.notes }) },
      {
        onSuccess: () => { toast.success(item ? 'Fee updated' : 'Fee added'); onDone(); },
        onError: (e) => serverFieldErrors(e, ['title', 'total', 'dueDate', 'academicYear']).forEach((x) => setError(x.field as keyof Values, { message: x.message })),
      },
    );
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(submit)}>
      <FormError message={save.error instanceof ApiError && !save.error.details?.length ? save.error.message : null} />
      <Field label="Title" error={errors.title?.message}>{(id) => <Input id={id} autoFocus={!item} placeholder="e.g. Semester 3 tuition" invalid={!!errors.title} {...register('title')} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">{(id) => <Select id={id} {...register('category')}>{FEE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select>}</Field>
        <Field label="Academic year" error={errors.academicYear?.message}>{(id) => <Input id={id} placeholder="2026-27" invalid={!!errors.academicYear} {...register('academicYear')} />}</Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total due" error={errors.total?.message}>{(id) => <AmountInput id={id} invalid={!!errors.total} {...register('total')} />}</Field>
        <Field label="Due date" error={errors.dueDate?.message}>{(id) => <Input id={id} type="date" invalid={!!errors.dueDate} {...register('dueDate')} />}</Field>
      </div>
      <Field label="Notes" optional>{(id) => <Textarea id={id} {...register('notes')} />}</Field>
      <p className="text-xs text-muted">Adding a fee doesn’t change your balance. Only payments you record do.</p>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={save.isPending}>{item ? 'Save changes' : 'Add fee'}</Button>
      </div>
    </form>
  );
}

const paySchema = z.object({
  amount: amountRule(),
  date: z.string().min(1, 'Pick a date'),
  referenceNo: z.string().trim().max(80),
  notes: z.string().trim().max(500),
});
type PayValues = z.infer<typeof paySchema>;

export function PaymentForm({ fee, onDone }: { fee: Fee; onDone: () => void }) {
  const add = useAddPayment(fee.id);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<PayValues>({
    resolver: zodResolver(paySchema),
    defaultValues: { amount: paiseToInput(fee.remainingPaise), date: todayIST(), referenceNo: '', notes: '' },
  });
  const submit = (v: PayValues) =>
    add.mutate(
      { amount: normalizeAmount(v.amount)!, date: v.date, ...(v.referenceNo && { referenceNo: v.referenceNo }), ...(v.notes && { notes: v.notes }) },
      {
        onSuccess: () => { toast.success('Payment recorded'); onDone(); },
        onError: (e) => setError('amount', { message: e instanceof ApiError ? e.message : 'Couldn’t record the payment.' }),
        // Field errors from the server (amount above the balance due) land on the amount field via onError above.
      },
    );
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(submit)}>
      <p className="text-sm text-muted">{fee.title}: <Money paise={fee.remainingPaise} /> still due.</p>
      <Field label="Amount paid" hint="Part payments are fine. This reduces your balance by what you pay now." error={errors.amount?.message}>{(id) => <AmountInput id={id} autoFocus invalid={!!errors.amount} {...register('amount')} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Payment date" error={errors.date?.message}>{(id) => <Input id={id} type="date" max={todayIST()} {...register('date')} />}</Field>
        <Field label="Reference no." optional>{(id) => <Input id={id} {...register('referenceNo')} />}</Field>
      </div>
      <Field label="Notes" optional>{(id) => <Input id={id} {...register('notes')} />}</Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={add.isPending}>Record payment</Button>
      </div>
    </form>
  );
}
