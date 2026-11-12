import { Plus } from 'lucide-react';
import { useState } from 'react';
import { RowActions } from '@/components/RowActions';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Confirm';
import { FilterSelect } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Money, PageHeader, Pagination, ProgressBar, StatusBadge } from '@/components/ui/Parts';
import { EmptyState, ErrorState, ListSkeleton, Skeleton } from '@/components/ui/States';
import { FeeForm, PaymentForm } from '@/features/fees/forms';
import { useDateFormat } from '@/hooks/useUser';
import { api } from '@/services/api';
import { useFee, useFees, useSave } from '@/services/queries';
import { FEE_CATEGORY_LABELS, type Fee } from '@/types/api';
import { formatDate, relativeDue } from '@/utils/date';
import { Trash2 } from 'lucide-react';

type ModalState = { kind: 'add' | 'edit' | 'pay' | 'complete' | 'delete' | 'history'; fee?: Fee } | null;

function History({ feeId, onClose }: { feeId: string; onClose: () => void }) {
  const fmt = useDateFormat();
  const q = useFee(feeId);
  const [removing, setRemoving] = useState<string | null>(null);
  const del = useSave((pid: string) => api.del(`/fees/${feeId}/payments/${pid}`), 'Payment removed');
  if (q.isPending) return <Skeleton className="h-28 w-full" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const fee = q.data;
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-sm text-muted">{fee.title}</p><p className="mt-1 text-2xl font-semibold tabular-nums"><Money paise={fee.paidPaise} /> <span className="text-base font-normal text-muted">of <Money paise={fee.totalPaise} /></span></p></div>
        <StatusBadge status={fee.status} />
      </div>
      {fee.payments.length ? (
        <ul className="divide-y rounded-md border">
          {fee.payments.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-2 pl-3 pr-1.5">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium"><Money paise={p.amountPaise} /></p><p className="truncate text-[13px] text-muted">{formatDate(p.date, fmt)}{p.referenceNo ? ` · Ref ${p.referenceNo}` : ''}{p.notes ? ` · ${p.notes}` : ''}</p></div>
              <IconButton label={`Remove payment of ${p.amountPaise / 100} rupees`} onClick={() => setRemoving(p.id)}><Trash2 className="size-4" /></IconButton>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-md border border-dashed px-4 py-6 text-center text-[13px] text-muted">No payments recorded for this fee yet.</p>}
      <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>
      <ConfirmDialog open={!!removing} title="Remove this payment?" message="The amount returns to your balance and the fee shows it as unpaid again." confirmLabel="Remove payment" onConfirm={() => del.mutateAsync(removing!)} onClose={() => setRemoving(null)} />
    </div>
  );
}

export default function FeesPage() {
  const fmt = useDateFormat();
  const [f, setF] = useState({ year: '', status: '', page: 1 });
  const q = useFees({ page: f.page, limit: 12, academicYear: f.year || undefined, status: f.status || undefined });
  const years = useFees({ limit: 100 });
  const yearOptions = [...new Set((years.data?.items ?? []).map((x) => x.academicYear))].sort().reverse();
  const [modal, setModal] = useState<ModalState>(null);
  const close = () => setModal(null);
  const del = useSave((id: string) => api.del(`/fees/${id}`), 'Fee deleted');
  const complete = useSave((id: string) => api.post(`/fees/${id}/complete`), 'Fee marked as paid');
  const fee = modal?.fee;
  const filtered = !!(f.year || f.status);
  const totalDue = (q.data?.items ?? []).reduce((s, x) => s + x.remainingPaise, 0);

  return (
    <>
      <PageHeader title="Fees & Payments" description="Track what you owe the college and hostel. Only payments you record change your balance."
        actions={<Button onClick={() => setModal({ kind: 'add' })}><Plus className="size-4" aria-hidden />Add fee</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect label="Academic year" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value, page: 1 })}><option value="">All years</option>{yearOptions.map((y) => <option key={y}>{y}</option>)}</FilterSelect>
        <FilterSelect label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })}><option value="">Any status</option><option value="pending">Pending</option><option value="partially_paid">Partially paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option></FilterSelect>
        {q.data?.items.length ? <span className="ml-auto text-[13px] text-muted">Left to pay on this page: <Money paise={totalDue} /></span> : null}
      </div>

      {q.isPending ? <ListSkeleton rows={4} /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        : q.data.items.length ? (
          <ul className="space-y-3">
            {q.data.items.map((x) => {
              const pct = Math.min(100, Math.floor((x.paidPaise * 100) / x.totalPaise));
              return (
                <li key={x.id} className="rounded-md border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{x.title}</p>
                      <p className="mt-0.5 text-[13px] text-muted">{FEE_CATEGORY_LABELS[x.category]} · {x.academicYear} · Due {formatDate(x.dueDate, fmt)}{x.status !== 'paid' && ` (${relativeDue(x.dueDate).toLowerCase()})`}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1"><StatusBadge status={x.status} /><RowActions name={x.title} onEdit={() => setModal({ kind: 'edit', fee: x })} onDelete={() => setModal({ kind: 'delete', fee: x })} /></div>
                  </div>
                  <div className="mt-4"><ProgressBar percent={pct} level={x.status === 'overdue' ? 'over' : 'ok'} label={`${x.title} paid`} /></div>
                  <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 text-[13px] text-muted">
                    <span><Money paise={x.paidPaise} /> paid of <Money paise={x.totalPaise} /></span>
                    <span className="font-medium text-text">{x.remainingPaise > 0 ? <><Money paise={x.remainingPaise} /> left</> : 'Fully paid'}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {x.status !== 'paid' && <><Button size="sm" onClick={() => setModal({ kind: 'pay', fee: x })}>Record payment</Button><Button size="sm" variant="secondary" onClick={() => setModal({ kind: 'complete', fee: x })}>Mark as paid</Button></>}
                    <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'history', fee: x })}>Payment history</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title={filtered ? 'No fees match' : 'No fees added yet'} description={filtered ? 'Try another year or status.' : 'Add tuition, hostel, exam and other fees with their due dates. You will get reminders as deadlines approach.'} action={!filtered && <Button onClick={() => setModal({ kind: 'add' })}>Add your first fee</Button>} />}
      <Pagination meta={q.data?.meta} onPage={(page) => setF({ ...f, page })} />

      <Modal open={modal?.kind === 'add'} onClose={close} title="Add fee"><FeeForm onDone={close} /></Modal>
      <Modal open={modal?.kind === 'edit'} onClose={close} title="Edit fee">{fee && <FeeForm fee={fee} onDone={close} />}</Modal>
      <Modal open={modal?.kind === 'pay'} onClose={close} title="Record payment">{fee && <PaymentForm fee={fee} onDone={close} />}</Modal>
      <Modal open={modal?.kind === 'history'} onClose={close} title="Payment history">{fee && <History feeId={fee.id} onClose={close} />}</Modal>
      <ConfirmDialog open={modal?.kind === 'complete'} title="Mark as paid?" message={fee ? `This records a payment of the remaining amount for "${fee.title}" and reduces your balance by that amount.` : ''} confirmLabel="Record payment" onConfirm={() => complete.mutateAsync(fee!.id)} onClose={close} />
      <ConfirmDialog open={modal?.kind === 'delete'} title="Delete this fee?" message={fee ? `"${fee.title}" and its payment history will be removed. Payments already made return to your balance.` : ''} confirmLabel="Delete fee" onConfirm={() => del.mutateAsync(fee!.id)} onClose={close} />
    </>
  );
}
