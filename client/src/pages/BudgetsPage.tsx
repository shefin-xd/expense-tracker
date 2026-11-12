import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Money, PageHeader, Panel, ProgressBar } from '@/components/ui/Parts';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { BudgetForm } from '@/features/budgets/forms';
import { useBudget, useBudgetCompare } from '@/services/queries';
import type { BudgetLine } from '@/types/api';
import { currentMonthKey, formatMonth, shiftMonth } from '@/utils/date';

const LEVEL_TEXT = { ok: '', warning: 'Close to the limit', over: 'Over the limit' } as const;

function Line({ name, line }: { name: string; line: BudgetLine }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{name}</span>
        <span className="tabular-nums text-muted"><Money paise={line.spentPaise} /> of <Money paise={line.limitPaise} /></span>
      </div>
      <div className="mt-2"><ProgressBar percent={line.percentUsed} level={line.level} label={`${name} budget used`} /></div>
      <p className={`mt-1.5 text-[13px] ${line.level === 'over' ? 'text-danger' : 'text-muted'}`}>
        {line.percentUsed}% used · {line.remainingPaise >= 0 ? <><Money paise={line.remainingPaise} /> left</> : <><Money paise={-line.remainingPaise} /> over</>}{LEVEL_TEXT[line.level] && ` · ${LEVEL_TEXT[line.level]}`}
      </p>
    </li>
  );
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonthKey());
  const q = useBudget(month);
  const cmp = useBudgetCompare(month);
  const [editing, setEditing] = useState(false);
  const b = q.data;
  const c = cmp.data;
  return (
    <>
      <PageHeader title="Budgets" description="Set a limit and see how much of it you have used."
        actions={<Button onClick={() => setEditing(true)} disabled={q.isPending}>{b?.hasBudget ? 'Edit budget' : 'Set budget'}</Button>} />
      <div className="mb-5 flex items-center gap-1">
        <IconButton label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="size-4" /></IconButton>
        <h2 className="min-w-40 text-center text-sm font-semibold" aria-live="polite">{formatMonth(month)}</h2>
        <IconButton label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="size-4" /></IconButton>
        {month !== currentMonthKey() && <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonthKey())}>This month</Button>}
      </div>

      {q.isPending ? <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-40 w-full" /></div> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : (
        <div className="space-y-6">
          <Panel>
            <p className="text-sm text-muted">Spent in {formatMonth(month)}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums"><Money paise={b!.spentPaise} /></p>
            {c && <p className="mt-2 text-[13px] text-muted">{c.changePaise === 0 ? 'Same as' : <><Money paise={Math.abs(c.changePaise)} /> {c.changePaise > 0 ? 'more than' : 'less than'}</>} {formatMonth(c.previousMonth)} (<Money paise={c.previousSpentPaise} />)</p>}
          </Panel>
          {!b!.hasBudget ? (
            <EmptyState title="No budget for this month" description="Set an overall limit, a limit for specific categories, or both. You will be warned when you reach 80%." action={<Button onClick={() => setEditing(true)}>Set budget</Button>} />
          ) : (
            <>
              {b!.overall && <Panel title="Overall limit"><ul><Line name="All spending" line={b!.overall} /></ul></Panel>}
              {b!.categories.length > 0 && <Panel title="By category"><ul className="space-y-6">{b!.categories.map((cat) => <Line key={cat.category} name={cat.category} line={cat} />)}</ul></Panel>}
            </>
          )}
        </div>
      )}
      <Modal open={editing} onClose={() => setEditing(false)} title={b?.hasBudget ? 'Edit budget' : 'Set budget'} wide>
        <BudgetForm key={month + String(editing)} month={month} current={b} onDone={() => setEditing(false)} />
      </Modal>
    </>
  );
}
