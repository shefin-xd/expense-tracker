import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormActions } from '@/components/FormParts';
import { AmountInput, TextArea, TextInput } from '@/components/ui/Field';
import { api } from '@/services/api';
import { useSave } from '@/services/queries';
import type { SavingsGoal } from '@/types/api';
import { toDayKey } from '@/utils/date';
import { paiseToInput } from '@/utils/money';
import { amountText, amountTextOrZero, optionalText } from '@/utils/schemas';

const schema = z.object({
  name: z.string().trim().min(1, 'Name your goal').max(100),
  target: amountText,
  saved: amountTextOrZero,
  targetDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a valid date'),
  description: optionalText(500),
});
type Values = z.infer<typeof schema>;

export function GoalForm({ goal, onDone }: { goal?: SavingsGoal; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: goal
      ? { name: goal.name, target: paiseToInput(goal.targetPaise), saved: paiseToInput(goal.savedPaise), targetDate: goal.targetDate ? toDayKey(goal.targetDate) : '', description: goal.description ?? '' }
      : { name: '', target: '', saved: '', targetDate: '', description: '' },
  });
  const save = useSave(
    (v: Values) => { const body = { name: v.name, target: v.target, saved: v.saved || '0', ...(v.targetDate ? { targetDate: v.targetDate } : {}), ...(v.description ? { description: v.description } : {}) }; return goal ? api.patch(`/savings/${goal.id}`, body) : api.post('/savings', body); },
    goal ? 'Goal updated' : 'Goal added',
    onDone,
  );
  return (
    <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
      <TextInput label="Goal" placeholder="e.g. New laptop" autoFocus error={errors.name?.message} {...register('name')} />
      <div className="grid grid-cols-2 gap-3">
        <AmountInput label="Target amount" error={errors.target?.message} {...register('target')} />
        <AmountInput label="Saved so far" error={errors.saved?.message} {...register('saved')} />
      </div>
      <TextInput label="Target date (optional)" type="date" error={errors.targetDate?.message} {...register('targetDate')} />
      <TextArea label="Description (optional)" error={errors.description?.message} {...register('description')} />
      <p className="text-[13px] text-muted">Savings goals are tracked on their own. They do not change your available balance.</p>
      <FormActions onCancel={onDone} busy={save.isPending} submitLabel={goal ? 'Save changes' : 'Add goal'} />
    </form>
  );
}
