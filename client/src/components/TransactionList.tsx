import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight, CreditCard, HandCoins, Undo2, Wallet, type LucideIcon } from 'lucide-react';
import { useDateFormat } from '@/hooks/useUser';
import { MONEY_IN, type LedgerKind, type Transaction } from '@/types/api';
import { formatDate } from '@/utils/date';
import { Money } from './ui/Parts';

export const KIND_LABELS: Record<LedgerKind, string> = {
  income: 'Income', expense: 'Expense', fee_payment: 'Fee payment', lend_out: 'Lent', lend_repayment: 'Repaid to you', borrow_in: 'Borrowed', borrow_repayment: 'You repaid',
};

/** Each kind gets its own iOS-style icon tile, so the list can be scanned by colour as well as by sign. */
const TILE: Record<LedgerKind, { icon: LucideIcon; bg: string }> = {
  income: { icon: ArrowDownLeft, bg: 'bg-success' },
  expense: { icon: ArrowUpRight, bg: 'bg-warning' },
  fee_payment: { icon: CreditCard, bg: 'bg-indigo' },
  lend_out: { icon: HandCoins, bg: 'bg-purple' },
  lend_repayment: { icon: Undo2, bg: 'bg-teal' },
  borrow_in: { icon: Wallet, bg: 'bg-pink' },
  borrow_repayment: { icon: Undo2, bg: 'bg-accent' },
};

export function TransactionRow({ t }: { t: Transaction }) {
  const fmt = useDateFormat();
  const incoming = MONEY_IN.includes(t.kind);
  const { icon: Icon, bg } = TILE[t.kind];
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={clsx('grid size-9 shrink-0 place-items-center rounded-[9px] text-white', bg)} aria-hidden><Icon className="size-[18px]" strokeWidth={2.4} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-medium leading-tight">{t.title}</p>
        <p className="mt-0.5 truncate text-[13px] text-muted">{[KIND_LABELS[t.kind], t.category && t.category !== KIND_LABELS[t.kind] ? t.category : null, formatDate(t.date, fmt)].filter(Boolean).join(' · ')}</p>
      </div>
      <p className={clsx('shrink-0 text-[16px] font-semibold tabular-nums', incoming && 'text-success')}>
        <span className="sr-only">{incoming ? 'Money in ' : 'Money out '}</span>{incoming ? '+' : '−'}<Money paise={t.amountPaise} />
      </p>
    </li>
  );
}

export function TransactionList({ items }: { items: Transaction[] }) {
  return <ul className="divide-y">{items.map((t) => <TransactionRow key={t.id} t={t} />)}</ul>;
}
