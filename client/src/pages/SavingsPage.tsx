import { Plus } from 'lucide-react';
import { useState } from 'react';
import { RowActions } from '@/components/RowActions';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Confirm';
import { Modal } from '@/components/ui/Modal';
import { Money, PageHeader, ProgressBar, Stat } from '@/components/ui/Parts';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';
import { GoalForm } from '@/features/savings/forms';
import { useDateFormat } from '@/hooks/useUser';
import { api } from '@/services/api';
import { useSave, useSavings } from '@/services/queries';
import type { SavingsGoal } from '@/types/api';
import { formatDate } from '@/utils/date';

export default function SavingsPage() {
  const fmt = useDateFormat();
  const q = useSavings();
  const [modal, setModal] = useState<{ kind: 'add' | 'edit' | 'delete'; goal?: SavingsGoal } | null>(null);
  const close = () => setModal(null);
  const del = useSave((id: string) => api.del(`/savings/${id}`), 'Goal deleted');
  const goal = modal?.goal;
  return (
    <>
      <PageHeader title="Savings" description="Goals you are putting money towards." actions={<Button onClick={() => setModal({ kind: 'add' })}><Plus className="size-4" aria-hidden />Add goal</Button>} />
      {q.isPending ? <ListSkeleton rows={3} /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : q.data.goals.length ? (
        <>
          <dl className="mb-6 grid grid-cols-2 gap-4 rounded-2xl bg-surface p-4 shadow-card">
            <Stat label="Saved so far" value={<Money paise={q.data.totalSavedPaise} decimals={false} />} />
            <Stat label="Combined target" value={<Money paise={q.data.totalTargetPaise} decimals={false} />} />
          </dl>
          <ul className="space-y-3">
            {q.data.goals.map((g) => (
              <li key={g.id} className="rounded-2xl bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{g.name}</p>{(g.targetDate || g.description) && <p className="mt-0.5 text-[13px] text-muted">{[g.targetDate && `Target ${formatDate(g.targetDate, fmt)}`, g.description].filter(Boolean).join(' · ')}</p>}</div>
                  <RowActions name={g.name} onEdit={() => setModal({ kind: 'edit', goal: g })} onDelete={() => setModal({ kind: 'delete', goal: g })} />
                </div>
                <div className="mt-4"><ProgressBar percent={g.percentSaved} level={g.reached ? 'done' : 'ok'} label={`${g.name} saved`} /></div>
                <div className="mt-2 flex justify-between gap-4 text-[13px] text-muted">
                  <span><Money paise={g.savedPaise} /> of <Money paise={g.targetPaise} /> · {g.percentSaved}%</span>
                  <span className="font-medium text-text">{g.reached ? 'Goal reached' : <><Money paise={g.remainingPaise} /> to go</>}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : <EmptyState title="No savings goals yet" description="A laptop, an emergency fund, a trip. Set a target and track how close you are." action={<Button onClick={() => setModal({ kind: 'add' })}>Add your first goal</Button>} />}
      <Modal open={modal?.kind === 'add'} onClose={close} title="Add savings goal"><GoalForm onDone={close} /></Modal>
      <Modal open={modal?.kind === 'edit'} onClose={close} title="Edit savings goal">{goal && <GoalForm goal={goal} onDone={close} />}</Modal>
      <ConfirmDialog open={modal?.kind === 'delete'} title="Delete this goal?" message={goal ? `"${goal.name}" will be removed. Your balance is not affected.` : ''} confirmLabel="Delete goal" onConfirm={() => del.mutateAsync(goal!.id)} onClose={close} />
    </>
  );
}
