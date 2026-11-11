import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/display';
import { useUi } from '@/store/ui';
import { ExpenseForm } from '../expenses/ExpenseForm';
import { FeeForm } from '../fees/FeeForm';
import { IncomeForm } from '../income/IncomeForm';

type Tab = 'expense' | 'income' | 'fee';

/** One global entry point for adding things, reachable from the header, the phone "+" button and dashboard quick actions. */
export function QuickAddHost() {
  const { quick, openQuick, closeQuick } = useUi();
  const titles: Record<Tab, string> = { expense: 'Add expense', income: 'Add income', fee: 'Add fee or payment due' };
  return (
    <Modal open={!!quick} onClose={closeQuick} title={quick ? titles[quick.type] : 'Add'}>
      {quick && (
        <div className="space-y-4">
          <Segmented<Tab> label="What are you adding?" value={quick.type} onChange={(t) => openQuick({ type: t })}
            options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'fee', label: 'Fee' }]} />
          {/* key resets the form when switching tabs */}
          {quick.type === 'expense' && <ExpenseForm key="e" onDone={closeQuick} />}
          {quick.type === 'income' && <IncomeForm key={`i-${quick.source ?? ''}`} {...(quick.source && { source: quick.source })} onDone={closeQuick} />}
          {quick.type === 'fee' && <FeeForm key="f" onDone={closeQuick} />}
        </div>
      )}
    </Modal>
  );
}
