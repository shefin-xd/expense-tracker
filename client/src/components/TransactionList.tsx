import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useDateFormat } from '@/hooks/useUser';
import { MONEY_IN, type LedgerKind, type Transaction } from '@/types/api';
import { formatDate } from '@/utils/date';
import { Money } from './ui/Parts';

export const KIND_LABELS: Record<LedgerKind, string> = {
  income: 'Income', expense: 'Expense', fee_payment: 'Fee payment', lend_out: 'Lent', lend_repayment: 'Repaid to you', borrow_in: 'Borrowed', borrow_repayment: 'You repaid',
};

/** Money in is shown with + and an incoming arrow, money out with a minus and an outgoing arrow. */
export function TransactionRow({ t }: { t: Transaction }) {
  const fmt = useDateFormat();
  const incoming = MONEY_IN.includes(t.kind);
  const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={clsx('grid size-8 shrink-0 place-items-center rounded-md border', incoming ? 'border-accent/40 text-accent' : 'text-muted')} aria-hidden><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.title}</p>
        <p className="truncate text-[13px] text-muted">{[KIND_LABELS[t.kind], t.category && t.category !== KIND_LABELS[t.kind] ? t.category : null, formatDate(t.date, fmt)].filter(Boolean).join(' · ')}</p>
      </div>
      <p className={clsx('shrink-0 text-sm font-medium tabular-nums', incoming && 'text-accent')}>
        <span className="sr-only">{incoming ? 'Money in ' : 'Money out '}</span>{incoming ? '+' : '−'}<Money paise={t.amountPaise} />
      </p>
    </li>
  );
}

export function TransactionList({ items }: { items: Transaction[] }) {
  return <ul className="divide-y">{items.map((t) => <TransactionRow key={t.id} t={t} />)}</ul>;
}
