import { ArrowDownToLine, CreditCard, HandCoins, Receipt } from 'lucide-react';
import { create } from 'zustand';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { SelectInput } from '@/components/ui/Field';
import { ExpenseForm } from '@/features/expenses/forms';
import { PaymentForm } from '@/features/fees/forms';
import { IncomeForm } from '@/features/income/forms';
import { useFees } from '@/services/queries';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type QuickKind = 'menu' | 'expense' | 'income' | 'received' | 'payment' | null;
export const useQuickAdd = create<{ kind: QuickKind; open: (k: Exclude<QuickKind, null>) => void; close: () => void }>((set) => ({
  kind: null,
  open: (kind) => set({ kind }),
  close: () => set({ kind: null }),
}));

function PaymentPicker({ onDone }: { onDone: () => void }) {
  const fees = useFees({ limit: 100 });
  const nav = useNavigate();
  const unpaid = (fees.data?.items ?? []).filter((f) => f.status !== 'paid');
  const [id, setId] = useState('');
  if (fees.isPending) return <Skeleton className="h-24 w-full" />;
  if (!unpaid.length) {
    return <EmptyState title="No fees waiting for payment" description="Add a fee first, then record payments against it as you pay." action={<Button onClick={() => { onDone(); nav('/fees'); }}>Go to Fees & Payments</Button>} />;
  }
  const fee = unpaid.find((f) => f.id === id) ?? unpaid[0]!;
  return (
    <div className="space-y-4">
      <SelectInput label="Which fee?" value={fee.id} onChange={(e) => setId(e.target.value)}>{unpaid.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}</SelectInput>
      <PaymentForm key={fee.id} fee={fee} onDone={onDone} />
    </div>
  );
}

const ACTIONS = [
  { kind: 'expense', label: 'Add expense', hint: 'Something you spent', icon: Receipt },
  { kind: 'income', label: 'Add income', hint: 'Scholarship, work, refunds', icon: ArrowDownToLine },
  { kind: 'payment', label: 'Add payment', hint: 'Pay towards a college or hostel fee', icon: CreditCard },
  { kind: 'received', label: 'Add money received', hint: 'Sent by your parents', icon: HandCoins },
] as const;

/** One host for every "add" flow so the Add button, the dashboard shortcuts and the mobile bar behave the same. */
export function QuickAddHost() {
  const { kind, open, close } = useQuickAdd();
  const titles = { menu: 'Add', expense: 'Add expense', income: 'Add income', received: 'Add money received', payment: 'Add payment' } as const;
  return (
    <Modal open={kind !== null} onClose={close} title={kind ? titles[kind] : 'Add'}>
      {kind === 'menu' && (
        <ul className="-my-2 divide-y">
          {ACTIONS.map((a) => (
            <li key={a.kind}>
              <button onClick={() => open(a.kind)} className="flex w-full items-center gap-3 py-3.5 text-left hover:bg-surface sm:-mx-2 sm:px-2 rounded-md">
                <a.icon className="size-5 text-muted" aria-hidden />
                <span><span className="block text-sm font-medium">{a.label}</span><span className="block text-[13px] text-muted">{a.hint}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {kind === 'expense' && <ExpenseForm quick onDone={close} />}
      {kind === 'income' && <IncomeForm onDone={close} />}
      {kind === 'received' && <IncomeForm presetSource="parents" onDone={close} />}
      {kind === 'payment' && <PaymentPicker onDone={close} />}
    </Modal>
  );
}
