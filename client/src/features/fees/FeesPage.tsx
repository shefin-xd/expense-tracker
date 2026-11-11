import { CheckCircle2, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, Money, PageHeader, ProgressBar, Section, Stat } from '@/components/ui/display';
import { EmptyState, ErrorState, ListSkeleton, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useDateFormat } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { feeCategoryLabel, FEE_STATUS } from '@/lib/constants';
import { formatDate, relativeDue } from '@/lib/dates';
import { pct } from '@/lib/money';
import type { Fee, FeeStatus } from '@/lib/types';
import { toast } from '@/store/toast';
import { useUi } from '@/store/ui';
import { useCompleteFee, useDeleteFee, useDeletePayment, useFee, useFees } from './api';
import { FeeForm, PaymentForm } from './FeeForm';

const tone = (s: FeeStatus) => (s === 'paid' ? 'good' : s === 'overdue' ? 'danger' : s === 'partially_paid' ? 'primary' : 'neutral') as 'good' | 'danger' | 'primary' | 'neutral';
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Try again.');

function FeeDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (f: Fee) => void }) {
  const fmt = useDateFormat();
  const q = useFee(id);
  const complete = useCompleteFee();
  const del = useDeleteFee();
  const delPay = useDeletePayment();
  const [paying, setPaying] = useState(false);
  const [confirm, setConfirm] = useState<'complete' | 'delete' | { paymentId: string } | null>(null);

  if (q.isPending) return <div className="space-y-3"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-2 w-full" /><Skeleton className="h-24 w-full" /></div>;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const f = q.data;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold">{f.title}</p>
          <p className="text-xs text-muted">{feeCategoryLabel(f.category)} · {f.academicYear}</p>
        </div>
        <Badge tone={tone(f.status)}>{FEE_STATUS[f.status]}</Badge>
      </div>

      <div className="mt-4 space-y-2">
        <ProgressBar percent={pct(f.paidPaise, f.totalPaise)} label="Paid" />
        <div className="flex justify-between text-sm">
          <span className="text-muted">Paid <Money paise={f.paidPaise} /></span>
          <span className="font-medium">Remaining <Money paise={f.remainingPaise} /></span>
        </div>
        <p className="text-xs text-muted">Total <Money paise={f.totalPaise} /> · Due {formatDate(f.dueDate, fmt)}{f.status !== 'paid' && ` (${relativeDue(f.dueDate).toLowerCase()})`}</p>
        {f.notes && <p className="pt-1 text-sm">{f.notes}</p>}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {f.remainingPaise > 0 && <Button onClick={() => setPaying(true)}>Record payment</Button>}
        {f.remainingPaise > 0 && <Button variant="secondary" onClick={() => setConfirm('complete')}><CheckCircle2 className="h-4 w-4" />Mark as paid</Button>}
        <Button variant="secondary" onClick={() => onEdit(f)}><Pencil className="h-4 w-4" />Edit</Button>
        <Button variant="danger" onClick={() => setConfirm('delete')}><Trash2 className="h-4 w-4" />Delete</Button>
      </div>

      <h3 className="mb-1 mt-6 text-[13px] font-medium">Payment history</h3>
      {f.payments.length === 0 ? <p className="py-3 text-sm text-muted">No payments recorded. Nothing has left your balance for this fee.</p> : (
        <ul className="divide-y divide-line border-y border-line">
          {f.payments.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm"><Money paise={p.amountPaise} /></p>
                <p className="truncate text-xs text-muted">{formatDate(p.date, fmt)}{p.referenceNo && ` · Ref ${p.referenceNo}`}{p.notes && ` · ${p.notes}`}</p>
              </div>
              <IconButton label="Delete payment" onClick={() => setConfirm({ paymentId: p.id })}><Trash2 className="h-4 w-4" /></IconButton>
            </li>
          ))}
        </ul>
      )}

      <Modal open={paying} onClose={() => setPaying(false)} title="Record payment">{paying && <PaymentForm fee={f} onDone={() => setPaying(false)} />}</Modal>

      <ConfirmDialog open={confirm === 'complete'} title="Mark as paid?" confirmLabel="Mark as paid" loading={complete.isPending}
        message={<>This records a payment of <Money paise={f.remainingPaise} /> dated today and reduces your balance by that amount.</>}
        onCancel={() => setConfirm(null)}
        onConfirm={() => complete.mutate(f.id, { onSuccess: () => { toast.success('Marked as paid'); setConfirm(null); }, onError: (e) => toast.error(errMsg(e)) })} />
      <ConfirmDialog open={confirm === 'delete'} title="Delete this fee?" loading={del.isPending}
        message={<>“{f.title}” and its {f.payments.length} recorded {f.payments.length === 1 ? 'payment' : 'payments'} will be removed{f.paidPaise > 0 && <>. Your balance goes back up by <Money paise={f.paidPaise} /></>}.</>}
        onCancel={() => setConfirm(null)}
        onConfirm={() => del.mutate(f.id, { onSuccess: () => { toast.success('Fee deleted'); setConfirm(null); onClose(); }, onError: (e) => toast.error(errMsg(e)) })} />
      <ConfirmDialog open={typeof confirm === 'object' && confirm !== null} title="Delete this payment?" loading={delPay.isPending}
        message="The amount goes back into your balance and the fee’s remaining amount goes up."
        onCancel={() => setConfirm(null)}
        onConfirm={() => typeof confirm === 'object' && confirm && delPay.mutate({ feeId: f.id, paymentId: confirm.paymentId }, { onSuccess: () => { toast.success('Payment deleted'); setConfirm(null); }, onError: (e) => toast.error(errMsg(e)) })} />
    </div>
  );
}

export default function FeesPage() {
  const fmt = useDateFormat();
  const openQuick = useUi((s) => s.openQuick);
  const q = useFees();
  const [year, setYear] = useState('');
  const [status, setStatus] = useState<'' | FeeStatus>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Fee | null>(null);

  const all = q.data?.items ?? [];
  const years = useMemo(() => [...new Set(all.map((f) => f.academicYear))].sort().reverse(), [all]);
  const shown = all.filter((f) => (!year || f.academicYear === year) && (!status || f.status === status));
  const open = shown.filter((f) => f.status !== 'paid');
  const remaining = open.reduce((s, f) => s + f.remainingPaise, 0);
  const paid = shown.reduce((s, f) => s + f.paidPaise, 0);
  const overdue = shown.filter((f) => f.status === 'overdue').length;

  return (
    <>
      <PageHeader title="Fees & payments" description="Track what you owe the college and hostel. Only payments you record change your balance."
        actions={<Button onClick={() => openQuick({ type: 'fee' })}><Plus className="h-4 w-4" />Add fee</Button>} />

      <Section className="mb-6">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Still to pay" value={<Money paise={remaining} />} />
          <Stat label="Paid so far" value={<Money paise={paid} />} />
          <Stat label="Overdue" value={overdue} hint={overdue ? 'Needs attention' : 'All on time'} />
        </div>
      </Section>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select aria-label="Academic year" value={year} onChange={(e) => setYear(e.target.value)} className="w-auto"><option value="">All years</option>{years.map((y) => <option key={y}>{y}</option>)}</Select>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as '' | FeeStatus)} className="w-auto">
          <option value="">All statuses</option>{(Object.keys(FEE_STATUS) as FeeStatus[]).map((s) => <option key={s} value={s}>{FEE_STATUS[s]}</option>)}
        </Select>
      </div>

      <Section flush>
        {q.isPending ? <div className="px-4"><ListSkeleton rows={3} /></div>
          : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          : shown.length === 0 ? (
            <EmptyState icon={GraduationCap} title={all.length ? 'No fees match these filters' : 'No fees added yet'}
              description={all.length ? 'Try a different year or status.' : 'Add tuition, hostel or exam fees to see deadlines and what’s left to pay.'}
              action={!all.length && <Button onClick={() => openQuick({ type: 'fee' })}><Plus className="h-4 w-4" />Add fee</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((f) => (
                <li key={f.id}>
                  <button onClick={() => setOpenId(f.id)} className="block w-full px-4 py-4 text-left transition-colors hover:bg-subtle">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{f.title}</p>
                        <p className="text-xs text-muted">{feeCategoryLabel(f.category)} · {f.academicYear}</p>
                      </div>
                      <Badge tone={tone(f.status)}>{FEE_STATUS[f.status]}</Badge>
                    </div>
                    <div className="mt-3"><ProgressBar percent={pct(f.paidPaise, f.totalPaise)} label={`${f.title} paid`} /></div>
                    <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-xs text-muted">
                      <span><Money paise={f.paidPaise} /> of <Money paise={f.totalPaise} /></span>
                      <span>{f.status === 'paid' ? `Cleared` : `${relativeDue(f.dueDate)} · ${formatDate(f.dueDate, fmt)}`}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </Section>

      <Modal open={!!openId} onClose={() => setOpenId(null)} title="Fee details" size="lg">
        {openId && <FeeDetail id={openId} onClose={() => setOpenId(null)} onEdit={(f) => { setEditing(f); }} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit fee">{editing && <FeeForm item={editing} onDone={() => setEditing(null)} />}</Modal>
    </>
  );
}
