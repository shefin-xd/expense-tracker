import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, Money, PageHeader, ProgressBar, Section, Segmented, Stat } from '@/components/ui/display';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useDateFormat } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { LOAN_STATUS } from '@/lib/constants';
import { formatDate, relativeDue } from '@/lib/dates';
import { pct } from '@/lib/money';
import type { Loan, LoanDirection, LoanStatus } from '@/lib/types';
import { toast } from '@/store/toast';
import { useDeleteLoan, useDeleteRepayment, useLoans, useLoanTotals } from './api';
import { LoanForm, RepaymentForm } from './LoanForms';

const tone = (s: LoanStatus) => (s === 'settled' ? 'good' : s === 'overdue' ? 'danger' : s === 'partially_settled' ? 'primary' : 'neutral') as 'good' | 'danger' | 'primary' | 'neutral';
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Try again.');

export default function LoansPage() {
  const fmt = useDateFormat();
  const [dir, setDir] = useState<LoanDirection>('lent');
  const lent = dir === 'lent';
  const list = useLoans(dir);
  const totals = useLoanTotals(dir);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [repaying, setRepaying] = useState<Loan | null>(null);
  const [deleting, setDeleting] = useState<Loan | null>(null);
  const [deletingRep, setDeletingRep] = useState<{ loan: Loan; id: string } | null>(null);
  const del = useDeleteLoan(dir);
  const delRep = useDeleteRepayment(dir);
  const t = totals.data;

  return (
    <>
      <PageHeader title="Borrow & lend" description="Keep track of money between you and your friends."
        actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" />{lent ? 'Lend money' : 'Borrow money'}</Button>} />

      <div className="mb-4"><Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'lent', label: 'Money I lent' }, { value: 'borrowed', label: 'Money I borrowed' }]} /></div>

      <Section className="mb-6">
        <div className="grid grid-cols-3 gap-4">
          <Stat label={lent ? 'Lent in total' : 'Borrowed in total'} value={t ? <Money paise={t.totalPaise} /> : '—'} />
          <Stat label={lent ? 'Paid back' : 'Repaid'} value={t ? <Money paise={t.repaidPaise} /> : '—'} />
          <Stat label={lent ? 'Friends owe you' : 'You owe'} value={t ? <Money paise={t.outstandingPaise} /> : '—'} />
        </div>
      </Section>

      <Section flush>
        {list.isPending ? <div className="px-4"><ListSkeleton rows={3} /></div>
          : list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          : list.data.items.length === 0 ? (
            <EmptyState icon={Users} title={lent ? 'Nothing lent yet' : 'Nothing borrowed yet'}
              description={lent ? 'When you lend money to a friend, record it here so you remember who owes you.' : 'When you borrow money, record it here so you remember who to pay back.'}
              action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" />{lent ? 'Lend money' : 'Borrow money'}</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {list.data.items.map((l) => (
                <li key={l.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.person}</p>
                      <p className="text-xs text-muted">{formatDate(l.date, fmt)}{l.expectedDate && l.status !== 'settled' && ` · ${relativeDue(l.expectedDate)}`}</p>
                    </div>
                    <Badge tone={tone(l.status)}>{LOAN_STATUS[l.status]}</Badge>
                  </div>
                  <div className="mt-3"><ProgressBar percent={pct(l.repaidPaise, l.amountPaise)} label={`${l.person} settled`} /></div>
                  <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-xs text-muted">
                    <span><Money paise={l.repaidPaise} /> of <Money paise={l.amountPaise} /></span>
                    <span className="font-medium text-fg">Remaining <Money paise={l.remainingPaise} /></span>
                  </div>
                  {l.notes && <p className="mt-2 text-xs text-muted">{l.notes}</p>}
                  {l.repayments.length > 0 && (
                    <ul className="mt-3 space-y-1 border-l border-line pl-3">
                      {l.repayments.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 text-xs text-muted">
                          <span><Money paise={r.amountPaise} /> on {formatDate(r.date, fmt)}{r.notes && ` · ${r.notes}`}</span>
                          <button aria-label="Delete repayment" onClick={() => setDeletingRep({ loan: l, id: r.id })} className="rounded p-1 hover:bg-subtle hover:text-fg"><Trash2 className="h-3.5 w-3.5" /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex items-center gap-1">
                    {l.remainingPaise > 0 && <Button size="sm" variant="secondary" onClick={() => setRepaying(l)}>{lent ? 'Record money back' : 'Record repayment'}</Button>}
                    <span className="flex-1" />
                    <IconButton label={`Edit ${l.person}`} onClick={() => setEditing(l)}><Pencil className="h-4 w-4" /></IconButton>
                    <IconButton label={`Delete ${l.person}`} onClick={() => setDeleting(l)}><Trash2 className="h-4 w-4" /></IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </Section>

      <Modal open={adding} onClose={() => setAdding(false)} title={lent ? 'Lend money' : 'Borrow money'}>{adding && <LoanForm direction={dir} onDone={() => setAdding(false)} />}</Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit">{editing && <LoanForm direction={dir} item={editing} onDone={() => setEditing(null)} />}</Modal>
      <Modal open={!!repaying} onClose={() => setRepaying(null)} title={lent ? 'Record money back' : 'Record repayment'}>{repaying && <RepaymentForm direction={dir} loan={repaying} onDone={() => setRepaying(null)} />}</Modal>

      <ConfirmDialog open={!!deleting} title="Delete this record?" loading={del.isPending}
        message={deleting && <>{deleting.person}’s record and its repayments will be removed. Your balance is adjusted to match.</>}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => { toast.success('Deleted'); setDeleting(null); }, onError: (e) => toast.error(errMsg(e)) })} />
      <ConfirmDialog open={!!deletingRep} title="Delete this repayment?" loading={delRep.isPending}
        message="The remaining amount goes back up and your balance is adjusted to match."
        onCancel={() => setDeletingRep(null)}
        onConfirm={() => deletingRep && delRep.mutate({ id: deletingRep.loan.id, repaymentId: deletingRep.id }, { onSuccess: () => { toast.success('Repayment deleted'); setDeletingRep(null); }, onError: (e) => toast.error(errMsg(e)) })} />
    </>
  );
}
