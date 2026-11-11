import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, Money, PageHeader, ProgressBar, Section, Stat } from '@/components/ui/display';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { AmountInput, Field, FormError, Input, Textarea } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useDateFormat } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { formatDate, istDay } from '@/lib/dates';
import { amountToPaise, normalizeAmount, normalizeAmountOrZero, paiseToInput } from '@/lib/money';
import type { SavingsGoal } from '@/lib/types';
import { toast } from '@/store/toast';
import { amountRule } from '../expenses/ExpenseForm';
import { useDeleteGoal, useGoals, useSaveGoal } from './api';

const schema = z.object({
  name: z.string().trim().min(1, 'Name your goal').max(100),
  target: amountRule('target'),
  saved: z.string().refine((v) => v.trim() === '' || normalizeAmountOrZero(v) !== null, 'Enter an amount like 500 or 0'),
  targetDate: z.string(),
  description: z.string().trim().max(500),
});
type Values = z.infer<typeof schema>;

function GoalForm({ item, onDone }: { item?: SavingsGoal; onDone: () => void }) {
  const save = useSaveGoal(item?.id);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { name: item.name, target: paiseToInput(item.targetPaise), saved: paiseToInput(item.savedPaise), targetDate: item.targetDate ? istDay(item.targetDate) : '', description: item.description ?? '' }
      : { name: '', target: '', saved: '', targetDate: '', description: '' },
  });
  const submit = (v: Values) =>
    save.mutate(
      { name: v.name, target: normalizeAmount(v.target)!, saved: v.saved.trim() ? normalizeAmountOrZero(v.saved)! : '0.00', ...(v.targetDate && { targetDate: v.targetDate }), ...(v.description && { description: v.description }) },
      { onSuccess: () => { toast.success(item ? 'Goal updated' : 'Goal created'); onDone(); } },
    );
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(submit)}>
      <FormError message={save.error instanceof ApiError ? save.error.message : null} />
      <Field label="Goal" error={errors.name?.message}>{(id) => <Input id={id} autoFocus={!item} placeholder="e.g. New laptop" invalid={!!errors.name} {...register('name')} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target amount" error={errors.target?.message}>{(id) => <AmountInput id={id} invalid={!!errors.target} {...register('target')} />}</Field>
        <Field label="Saved so far" error={errors.saved?.message}>{(id) => <AmountInput id={id} invalid={!!errors.saved} {...register('saved')} />}</Field>
      </div>
      <Field label="Target date" optional>{(id) => <Input id={id} type="date" {...register('targetDate')} />}</Field>
      <Field label="Description" optional>{(id) => <Textarea id={id} {...register('description')} />}</Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={save.isPending}>{item ? 'Save changes' : 'Create goal'}</Button>
      </div>
    </form>
  );
}

function AddMoney({ goal, onDone }: { goal: SavingsGoal; onDone: () => void }) {
  const save = useSaveGoal(goal.id);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = normalizeAmount(value);
    if (!n) return setError('Enter an amount like 500 or 500.50.');
    // Integer paise addition, formatted back to a rupee string.
    const next = paiseToInput(goal.savedPaise + amountToPaise(n));
    save.mutate({ name: goal.name, saved: next }, { onSuccess: () => { toast.success('Added to your goal'); onDone(); }, onError: (err) => setError(err instanceof ApiError ? err.message : 'Couldn’t save. Try again.') });
  };
  return (
    <form className="space-y-4" noValidate onSubmit={submit}>
      <p className="text-sm text-muted">{goal.name}: <Money paise={goal.savedPaise} /> of <Money paise={goal.targetPaise} /> saved.</p>
      <FormError message={error} />
      <Field label="Amount to add">{(id) => <AmountInput id={id} autoFocus value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
      <p className="text-xs text-muted">Savings goals are a tracker. Adding here doesn’t change your available balance.</p>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" loading={save.isPending}>Add to goal</Button></div>
    </form>
  );
}

export default function SavingsPage() {
  const fmt = useDateFormat();
  const q = useGoals();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [topUp, setTopUp] = useState<SavingsGoal | null>(null);
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null);
  const del = useDeleteGoal();

  return (
    <>
      <PageHeader title="Savings" description="Goals you’re working towards."
        actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" />New goal</Button>} />

      {q.data && q.data.goals.length > 0 && (
        <Section className="mb-6">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Saved across goals" value={<Money paise={q.data.totalSavedPaise} />} />
            <Stat label="Combined target" value={<Money paise={q.data.totalTargetPaise} />} />
          </div>
        </Section>
      )}

      <Section flush>
        {q.isPending ? <div className="px-4"><ListSkeleton rows={3} /></div>
          : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          : q.data.goals.length === 0 ? (
            <EmptyState icon={PiggyBank} title="No savings goals yet" description="Set a target for a laptop, an emergency fund or a trip, and watch it fill up."
              action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" />New goal</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {q.data.goals.map((g) => (
                <li key={g.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{g.name}</p>
                      <p className="text-xs text-muted">{g.targetDate ? `Target ${formatDate(g.targetDate, fmt)}` : 'No target date'}</p>
                    </div>
                    {g.reached && <Badge tone="good">Reached</Badge>}
                  </div>
                  {g.description && <p className="mt-1 text-xs text-muted">{g.description}</p>}
                  <div className="mt-3"><ProgressBar percent={g.percentSaved} label={`${g.name} progress`} /></div>
                  <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-xs text-muted">
                    <span><Money paise={g.savedPaise} /> of <Money paise={g.targetPaise} /> · {g.percentSaved}%</span>
                    {!g.reached && <span><Money paise={g.remainingPaise} /> to go</span>}
                  </div>
                  <div className="mt-3 flex items-center gap-1">
                    {!g.reached && <Button size="sm" variant="secondary" onClick={() => setTopUp(g)}>Add money</Button>}
                    <span className="flex-1" />
                    <IconButton label={`Edit ${g.name}`} onClick={() => setEditing(g)}><Pencil className="h-4 w-4" /></IconButton>
                    <IconButton label={`Delete ${g.name}`} onClick={() => setDeleting(g)}><Trash2 className="h-4 w-4" /></IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </Section>

      <Modal open={adding} onClose={() => setAdding(false)} title="New savings goal">{adding && <GoalForm onDone={() => setAdding(false)} />}</Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit goal">{editing && <GoalForm item={editing} onDone={() => setEditing(null)} />}</Modal>
      <Modal open={!!topUp} onClose={() => setTopUp(null)} title="Add to goal" size="sm">{topUp && <AddMoney goal={topUp} onDone={() => setTopUp(null)} />}</Modal>
      <ConfirmDialog open={!!deleting} title="Delete this goal?" loading={del.isPending}
        message={deleting && <>“{deleting.name}” will be removed. Your balance isn’t affected.</>}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => { toast.success('Goal deleted'); setDeleting(null); }, onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Couldn’t delete. Try again.') })} />
    </>
  );
}
