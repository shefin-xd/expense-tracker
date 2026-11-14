import { Plus } from 'lucide-react';
import { useState } from 'react';
import { RowActions } from '@/components/RowActions';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Confirm';
import { Modal } from '@/components/ui/Modal';
import { Money, Panel, StatusBadge } from '@/components/ui/Parts';
import { Skeleton } from '@/components/ui/States';
import { useDateFormat } from '@/hooks/useUser';
import { api } from '@/services/api';
import { useRecurring, useSave } from '@/services/queries';
import type { RecurringItem } from '@/types/api';
import { formatDate } from '@/utils/date';
import { ConfirmRecurringForm, RecurringForm } from './forms';

type ModalState = { kind: 'add' | 'edit' | 'confirm' | 'delete'; item?: RecurringItem } | null;

/** Confirm / Skip for one due item. Used on the dashboard and inside the monthly lists. */
export function DueActions({ item, onConfirm }: { item: RecurringItem; onConfirm: () => void }) {
  const skip = useSave(() => api.post(`/recurring/${item.id}/skip`), 'Skipped for this month');
  return (
    <div className="mt-2.5 flex gap-2">
      <Button size="sm" onClick={onConfirm}>{item.kind === 'income' ? 'Confirm received' : 'Confirm paid'}</Button>
      <Button size="sm" variant="secondary" loading={skip.isPending} onClick={() => skip.mutate(undefined)}>Skip this month</Button>
    </div>
  );
}

export function RecurringPanel({ kind }: { kind: 'income' | 'expense' }) {
  const fmt = useDateFormat();
  const q = useRecurring();
  const [modal, setModal] = useState<ModalState>(null);
  const close = () => setModal(null);
  const del = useSave((id: string) => api.del(`/recurring/${id}`), 'Removed');
  const items = (q.data?.items ?? []).filter((i) => i.kind === kind);
  const item = modal?.item;
  const income = kind === 'income';

  return (
    <Panel title={income ? 'Monthly allowance' : 'Monthly payments'} className="mb-6" flush
      action={<Button variant="ghost" size="sm" className="-mr-2" onClick={() => setModal({ kind: 'add' })}><Plus className="size-4" aria-hidden />Add</Button>}>
      {q.isPending ? <div className="p-4"><Skeleton className="h-12 w-full" /></div> : items.length ? (
        <ul className="divide-y">
          {items.map((r) => (
            <li key={r.id} className="py-3 pl-4 pr-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-medium">{r.name}</p>
                  <p className="text-[13px] text-muted"><Money paise={r.amountPaise} /> · day {r.dayOfMonth} of each month{!r.active ? '' : ` · next ${formatDate(r.nextDueDate, fmt)}`}</p>
                </div>
                <StatusBadge status={!r.active ? 'paused' : r.due ? 'due' : 'upcoming'} />
                <RowActions name={r.name} onEdit={() => setModal({ kind: 'edit', item: r })} onDelete={() => setModal({ kind: 'delete', item: r })} />
              </div>
              {r.due && r.active && <div className="pr-2"><DueActions item={r} onConfirm={() => setModal({ kind: 'confirm', item: r })} /></div>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-5 text-[15px] text-muted">
          {income ? 'Set up your monthly pocket money once. When the day comes you confirm what actually arrived, so your balance only ever counts real money.' : 'Add things you pay every month, like the mess fee or a recharge. You will be asked to confirm each one when it is due.'}
        </div>
      )}
      <Modal open={modal?.kind === 'add'} onClose={close} title={income ? 'Add monthly allowance' : 'Add monthly payment'}><RecurringForm kind={kind} onDone={close} /></Modal>
      <Modal open={modal?.kind === 'edit'} onClose={close} title="Edit monthly item">{item && <RecurringForm kind={kind} item={item} onDone={close} />}</Modal>
      <Modal open={modal?.kind === 'confirm'} onClose={close} title={income ? 'Confirm money received' : 'Confirm payment'}>{item && <ConfirmRecurringForm item={item} onDone={close} />}</Modal>
      <ConfirmDialog open={modal?.kind === 'delete'} title="Remove this monthly item?" message="Past records stay. Only the reminder is removed." confirmLabel="Remove" onConfirm={() => del.mutateAsync(item!.id)} onClose={close} />
    </Panel>
  );
}
