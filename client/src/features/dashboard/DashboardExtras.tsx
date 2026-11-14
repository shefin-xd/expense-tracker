import { X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Money, Panel } from '@/components/ui/Parts';
import { ConfirmRecurringForm } from '@/features/recurring/forms';
import { DueActions } from '@/features/recurring/RecurringPanel';
import { useQuickAdd } from '@/features/quickadd/QuickAdd';
import { useBudget, useFees, useRecurring } from '@/services/queries';
import type { Dashboard, RecurringItem } from '@/types/api';
import { currentMonthKey } from '@/utils/date';

/** Monthly items that have come due and are waiting for the user to confirm them. */
export function DueNow() {
  const q = useRecurring();
  const [item, setItem] = useState<RecurringItem | null>(null);
  const due = (q.data?.items ?? []).filter((i) => i.due && i.active);
  if (!due.length) return null;
  return (
    <Panel title="Waiting for you" flush>
      <ul className="divide-y">
        {due.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <p className="text-[16px] font-medium">{r.name}</p>
            <p className="text-[13px] text-muted">{r.kind === 'income' ? 'Expected' : 'Due'} this month · usually <Money paise={r.amountPaise} /></p>
            <DueActions item={r} onConfirm={() => setItem(r)} />
          </li>
        ))}
      </ul>
      <Modal open={!!item} onClose={() => setItem(null)} title={item?.kind === 'income' ? 'Confirm money received' : 'Confirm payment'}>{item && <ConfirmRecurringForm item={item} onDone={() => setItem(null)} />}</Modal>
    </Panel>
  );
}

const DISMISS_KEY = 'cl-onboarding-dismissed';

/** First-run checklist: the four things that make the app useful. Disappears when done or dismissed. */
export function GettingStarted({ dash }: { dash: Dashboard | undefined }) {
  const navigate = useNavigate();
  const open = useQuickAdd((s) => s.open);
  const fees = useFees({ limit: 1 });
  const budget = useBudget(currentMonthKey());
  const recurring = useRecurring();
  const [hidden, setHidden] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  if (hidden || !dash || fees.isPending || budget.isPending || recurring.isPending) return null;

  const steps = [
    { done: dash.allTime.totalIncomePaise > 0, title: 'Add the money you have', hint: 'Record what your parents sent or your starting balance', go: () => open('received') },
    { done: (fees.data?.meta.total ?? 0) > 0, title: 'Add a fee with its due date', hint: 'Tuition, hostel or exam fees, with reminders', go: () => navigate('/fees') },
    { done: !!budget.data?.hasBudget, title: 'Set a monthly budget', hint: 'Get a warning before you overspend', go: () => navigate('/budgets') },
    { done: (recurring.data?.items ?? []).some((i) => i.kind === 'income'), title: 'Set up your monthly allowance', hint: 'You confirm it each month, nothing posts by itself', go: () => navigate('/income') },
  ];
  if (steps.every((s) => s.done)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Panel title={`Getting started · ${doneCount} of ${steps.length}`} flush
      action={<IconButton label="Hide getting started" className="-mr-2 size-8" onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setHidden(true); }}><X className="size-4" /></IconButton>}>
      <ul className="divide-y">
        {steps.map((s) => (
          <li key={s.title}>
            <button onClick={s.go} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-fill">
              <span aria-hidden className={clsx('grid size-6 shrink-0 place-items-center rounded-full border-2', s.done ? 'border-success bg-success text-white' : 'border-faint')}>{s.done && <Check className="size-3.5" strokeWidth={3.5} />}</span>
              <span className="min-w-0 flex-1">
                <span className={clsx('block text-[16px]', s.done && 'text-muted line-through')}>{s.title}</span>
                {!s.done && <span className="block text-[13px] text-muted">{s.hint}</span>}
              </span>
              <span className="sr-only">{s.done ? 'Done' : 'To do'}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
