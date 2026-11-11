import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Money } from '@/components/ui/display';
import { KIND_LABEL, KIND_SIGN } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { useDateFormat } from '@/hooks/useAuth';
import type { LedgerEntry } from '@/lib/types';

/** One ledger movement. Direction is shown by icon and sign, so it never relies on colour alone. */
export function TransactionRow({ t }: { t: LedgerEntry }) {
  const fmt = useDateFormat();
  const inflow = KIND_SIGN[t.kind] === 1;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-muted" aria-hidden>
        {inflow ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.title}</p>
        <p className="truncate text-xs text-muted">{[t.category, KIND_LABEL[t.kind], formatDate(t.date, fmt)].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="text-right">
        <Money paise={inflow ? t.amountPaise : -t.amountPaise} sign className={clsx('text-sm font-medium', inflow && 'text-good')} />
        <p className="sr-only">{inflow ? 'Money in' : 'Money out'}</p>
      </div>
    </li>
  );
}
