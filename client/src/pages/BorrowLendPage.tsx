import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { RowActions } from '@/components/RowActions';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Confirm';
import { FilterSelect } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Money, PageHeader, Pagination, ProgressBar, Segmented, Stat, StatusBadge } from '@/components/ui/Parts';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';
import { LoanForm, RepaymentForm } from '@/features/lending/forms';
import { useDateFormat } from '@/hooks/useUser';
import { api } from '@/services/api';
import { useLoanTotals, useLoans, useSave, type Direction } from '@/services/queries';
import type { Loan } from '@/types/api';
import { formatDate, relativeDue } from '@/utils/date';

type ModalState = { kind: 'add' | 'edit' | 'repay' | 'delete' | 'history'; loan?: Loan } | null;

function History({ loan, direction, onClose }: { loan: Loan; direction: Direction; onClose: () => void }) {
  const fmt = useDateFormat();
  const [removing, setRemoving] = useState<string | null>(null);
  const del = useSave((rid: string) => api.del(`/${direction}/${loan.id}/repayments/${rid}`), 'Repayment removed', onClose);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{loan.person}: <Money paise={loan.repaidPaise} /> settled of <Money paise={loan.amountPaise} /></p>
      {loan.repayments.length ? (
        <ul className="divide-y rounded-md border">
          {loan.repayments.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-2 pl-3 pr-1.5">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium"><Money paise={r.amountPaise} /></p><p className="truncate text-[13px] text-muted">{formatDate(r.date, fmt)}{r.notes ? ` · ${r.notes}` : ''}</p></div>
              <IconButton label="Remove this repayment" onClick={() => setRemoving(r.id)}><Trash2 className="size-4" /></IconButton>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-md border border-dashed px-4 py-6 text-center text-[13px] text-muted">No repayments yet.</p>}
      <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>
      <ConfirmDialog open={!!removing} title="Remove this repayment?" message="Your balance and the amount still outstanding will be restored." confirmLabel="Remove repayment" onConfirm={() => del.mutateAsync(removing!)} onClose={() => setRemoving(null)} />
    </div>
  );
}

export default function BorrowLendPage() {
  const fmt = useDateFormat();
  const [direction, setDirection] = useState<Direction>('lending');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const lent = direction === 'lending';
  const q = useLoans(direction, { page, limit: 12, status: status || undefined });
  const totals = useLoanTotals(direction);
  const [modal, setModal] = useState<ModalState>(null);
  const close = () => setModal(null);
  const del = useSave((id: string) => api.del(`/${direction}/${id}`), 'Deleted');
  const loan = modal?.loan;
  const t = totals.data;

  return (
    <>
      <PageHeader title="Borrow & Lend" description="Keep track of money between you and your friends."
        actions={<Button onClick={() => setModal({ kind: 'add' })}><Plus className="size-4" aria-hidden />{lent ? 'Record loan' : 'Record borrowing'}</Button>} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Lent or borrowed" value={direction} onChange={(v) => { setDirection(v); setStatus(''); setPage(1); }} options={[{ value: 'lending', label: 'Money I lent' }, { value: 'borrowing', label: 'Money I borrowed' }]} />
        <FilterSelect label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Any status</option><option value="pending">Pending</option><option value="partially_settled">Partially settled</option><option value="overdue">Overdue</option><option value="settled">Settled</option></FilterSelect>
      </div>
      <dl className="mb-6 grid grid-cols-3 gap-4 rounded-md border p-4">
        <Stat label={lent ? 'Total lent' : 'Total borrowed'} value={<Money paise={t?.totalPaise ?? 0} decimals={false} />} />
        <Stat label={lent ? 'Paid back' : 'Repaid'} value={<Money paise={t?.repaidPaise ?? 0} decimals={false} />} />
        <Stat label={lent ? 'Friends still owe you' : 'You still owe'} value={<Money paise={t?.outstandingPaise ?? 0} decimals={false} />} />
      </dl>

      {q.isPending ? <ListSkeleton rows={4} /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        : q.data.items.length ? (
          <ul className="space-y-3">
            {q.data.items.map((l) => (
              <li key={l.id} className="rounded-md border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{l.person}</p>
                    <p className="mt-0.5 text-[13px] text-muted">{lent ? 'Lent' : 'Borrowed'} {formatDate(l.date, fmt)}{l.expectedDate ? ` · Expected ${formatDate(l.expectedDate, fmt)}${l.status !== 'settled' ? ` (${relativeDue(l.expectedDate).toLowerCase()})` : ''}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1"><StatusBadge status={l.status} /><RowActions name={l.person} onEdit={() => setModal({ kind: 'edit', loan: l })} onDelete={() => setModal({ kind: 'delete', loan: l })} /></div>
                </div>
                <div className="mt-4"><ProgressBar percent={Math.floor((l.repaidPaise * 100) / l.amountPaise)} level={l.status === 'overdue' ? 'over' : 'ok'} label={`${l.person} settled`} /></div>
                <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-[13px] text-muted">
                  <span><Money paise={l.repaidPaise} /> of <Money paise={l.amountPaise} /></span>
                  <span className="font-medium text-text">{l.remainingPaise > 0 ? <><Money paise={l.remainingPaise} /> left</> : 'Settled'}</span>
                </div>
                {l.notes && <p className="mt-2 text-[13px] text-muted">{l.notes}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {l.status !== 'settled' && <Button size="sm" onClick={() => setModal({ kind: 'repay', loan: l })}>{lent ? 'Record payback' : 'Record repayment'}</Button>}
                  {l.repayments.length > 0 && <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'history', loan: l })}>Repayments ({l.repayments.length})</Button>}
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyState title={status ? 'Nothing matches' : lent ? 'You have not lent any money' : 'You have not borrowed any money'} description={status ? 'Try another status.' : lent ? 'When you lend a friend money, record it here so you can see who still owes you.' : 'When you borrow from a friend, record it here so you remember what to pay back.'} action={!status && <Button onClick={() => setModal({ kind: 'add' })}>{lent ? 'Record a loan' : 'Record borrowing'}</Button>} />}
      <Pagination meta={q.data?.meta} onPage={setPage} />

      <Modal open={modal?.kind === 'add'} onClose={close} title={lent ? 'Record loan' : 'Record borrowing'}><LoanForm direction={direction} onDone={close} /></Modal>
      <Modal open={modal?.kind === 'edit'} onClose={close} title={lent ? 'Edit loan' : 'Edit borrowing'}>{loan && <LoanForm direction={direction} loan={loan} onDone={close} />}</Modal>
      <Modal open={modal?.kind === 'repay'} onClose={close} title={lent ? 'Record payback' : 'Record repayment'}>{loan && <RepaymentForm direction={direction} loan={loan} onDone={close} />}</Modal>
      <Modal open={modal?.kind === 'history'} onClose={close} title="Repayments">{loan && <History loan={loan} direction={direction} onClose={close} />}</Modal>
      <ConfirmDialog open={modal?.kind === 'delete'} title="Delete this record?" message={loan ? `${loan.person}'s ${lent ? 'loan' : 'borrowing'} and its repayments will be removed, and your balance is adjusted to match.` : ''} confirmLabel="Delete" onConfirm={() => del.mutateAsync(loan!.id)} onClose={close} />
    </>
  );
}
