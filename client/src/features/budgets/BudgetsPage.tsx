import { ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, Money, PageHeader, ProgressBar, Section } from '@/components/ui/display';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/Modal';
import { addMonths, monthLabel, thisMonthIST } from '@/lib/dates';
import { pct } from '@/lib/money';
import type { BudgetLevel, BudgetLine } from '@/lib/types';
import { useBudget, useBudgetCompare } from './api';
import { BudgetForm } from './BudgetForm';

const levelText: Record<BudgetLevel, string> = { ok: 'On track', warning: 'Close to the limit', over: 'Over budget' };
const levelTone = { ok: 'neutral', warning: 'warn', over: 'danger' } as const;

function Line({ name, line }: { name: string; line: BudgetLine }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium">{name}</p>
        {line.level !== 'ok' && <Badge tone={levelTone[line.level]}>{levelText[line.level]}</Badge>}
      </div>
      <div className="mt-2"><ProgressBar percent={line.percentUsed} level={line.level} label={`${name} budget used`} /></div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-4 text-xs text-muted">
        <span><Money paise={line.spentPaise} /> of <Money paise={line.limitPaise} /> · {line.percentUsed}%</span>
        <span className={line.remainingPaise < 0 ? 'text-danger' : ''}>{line.remainingPaise < 0 ? <>Over by <Money paise={-line.remainingPaise} /></> : <><Money paise={line.remainingPaise} /> left</>}</span>
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(thisMonthIST());
  const [editing, setEditing] = useState(false);
  const q = useBudget(month);
  const cmp = useBudgetCompare(month);
  const d = q.data;
  const topSpend = d?.spendingByCategory[0]?.totalPaise ?? 0;

  return (
    <>
      <PageHeader title="Budgets" description="Set limits for the month and see how you’re doing."
        actions={<Button onClick={() => setEditing(true)} disabled={!d}>{d?.hasBudget ? 'Edit budget' : 'Set budget'}</Button>} />

      <div className="mb-6 flex items-center gap-1">
        <IconButton label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></IconButton>
        <p className="min-w-36 text-center text-sm font-medium" aria-live="polite">{monthLabel(month)}</p>
        <IconButton label="Next month" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= addMonths(thisMonthIST(), 1)}><ChevronRight className="h-4 w-4" /></IconButton>
      </div>

      {q.isPending ? <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : (
          <div className="space-y-6">
            <Section title="This month">
              <p className="num text-3xl font-semibold tracking-tight"><Money paise={d!.spentPaise} /></p>
              <p className="mt-1 text-sm text-muted">spent in {monthLabel(month)}</p>
              {cmp.data && (
                <p className="mt-3 text-sm text-muted">
                  {cmp.data.changePaise === 0 ? `Same as ${monthLabel(cmp.data.previousMonth)}.`
                    : <><Money paise={Math.abs(cmp.data.changePaise)} /> {cmp.data.changePaise > 0 ? 'more' : 'less'} than {monthLabel(cmp.data.previousMonth)} (<Money paise={cmp.data.previousSpentPaise} />).</>}
                </p>
              )}
              {d!.overall && <div className="mt-5 border-t border-line pt-5"><Line name="Overall budget" line={d!.overall} /></div>}
            </Section>

            {d!.categories.length > 0 && (
              <Section title="Category budgets"><div className="space-y-5">{d!.categories.map((c) => <Line key={c.category} name={c.category} line={c} />)}</div></Section>
            )}

            {!d!.hasBudget && (
              <Section><EmptyState icon={Target} title="No budget for this month" description="Set an overall limit or limits per category. You’ll get a warning when you’re close." action={<Button onClick={() => setEditing(true)}>Set budget</Button>} /></Section>
            )}

            {d!.spendingByCategory.length > 0 && (
              <Section title="Where it went">
                <ul className="space-y-3">
                  {d!.spendingByCategory.map((s) => (
                    <li key={s.category}>
                      <div className="flex justify-between text-sm"><span>{s.category}</span><Money paise={s.totalPaise} /></div>
                      <div className="mt-1.5"><ProgressBar percent={pct(s.totalPaise, topSpend)} label={`${s.category} spending`} /></div>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted">Budgets count expenses only. Fee payments are tracked on the Fees page.</p>
              </Section>
            )}
          </div>
        )}

      <Modal open={editing} onClose={() => setEditing(false)} title={`Budget for ${monthLabel(month)}`}>
        {editing && <BudgetForm month={month} {...(d && { current: d })} onDone={() => setEditing(false)} />}
      </Modal>
    </>
  );
}
