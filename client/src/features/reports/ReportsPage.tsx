import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Money, PageHeader, Section, Segmented, Stat } from '@/components/ui/display';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/form';
import { api, ApiError, saveBlob } from '@/lib/api';
import { thisMonthIST, todayIST } from '@/lib/dates';
import { invalidateNotifications } from '@/lib/query';
import type { ReportSummary } from '@/lib/types';
import { toast } from '@/store/toast';

type Period = 'month' | 'year' | 'custom';
type Format = 'pdf' | 'xlsx' | 'csv';
const SCOPES = [
  { value: 'all', label: 'Full report' }, { value: 'expenses', label: 'Expenses only' },
  { value: 'income', label: 'Income only' }, { value: 'fees', label: 'Fees and payments' },
];
const CSV_SECTIONS = [
  { value: 'transactions', label: 'Transactions' }, { value: 'summary', label: 'Summary' }, { value: 'income', label: 'Income' }, { value: 'expenses', label: 'Expenses' },
  { value: 'categories', label: 'Category totals' }, { value: 'fees', label: 'Fees' }, { value: 'fee_payments', label: 'Fee payments' },
  { value: 'lent', label: 'Money lent' }, { value: 'borrowed', label: 'Money borrowed' }, { value: 'budgets', label: 'Budgets' }, { value: 'savings', label: 'Savings goals' },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [month, setMonth] = useState(thisMonthIST());
  const [year, setYear] = useState(todayIST().slice(0, 4));
  const [custom, setCustom] = useState({ from: `${thisMonthIST()}-01`, to: todayIST() });
  const [scope, setScope] = useState('all');
  const [csvSection, setCsvSection] = useState('transactions');
  const [busy, setBusy] = useState<Format | null>(null);

  const yearOk = /^\d{4}$/.test(year) && Number(year) >= 2000 && Number(year) <= 2100;
  const customOk = custom.from !== '' && custom.to !== '' && custom.from <= custom.to;
  const valid = period === 'month' ? month !== '' : period === 'year' ? yearOk : customOk;
  const rangeQuery = period === 'month' ? { month } : period === 'year' ? { year } : { from: custom.from, to: custom.to };
  const params = { ...rangeQuery, scope };

  const preview = useQuery({ queryKey: ['reports', 'summary', params], queryFn: () => api.get<ReportSummary>('/reports/summary', params), enabled: valid, placeholderData: (p) => p });

  const download = async (format: Format) => {
    setBusy(format);
    try {
      const { blob, filename } = await api.file(`/reports/${format}`, format === 'csv' ? { ...params, section: csvSection } : params);
      saveBlob(blob, filename);
      toast.success(`${format.toUpperCase()} report downloaded`);
      void invalidateNotifications();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Couldn’t create the report. Try again.');
    } finally { setBusy(null); }
  };

  const s = preview.data?.summary;
  return (
    <>
      <PageHeader title="Reports & exports" description="Download your records as a PDF report, an Excel workbook or CSV." />

      <Section title="Choose a report" className="mb-6">
        <div className="space-y-4">
          <Segmented<Period> label="Period" value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }, { value: 'custom', label: 'Custom range' }]} />
          <div className="grid gap-3 sm:grid-cols-2">
            {period === 'month' && <Field label="Month">{(id) => <Input id={id} type="month" value={month} max={thisMonthIST()} onChange={(e) => setMonth(e.target.value)} />}</Field>}
            {period === 'year' && <Field label="Year" error={yearOk ? undefined : 'Enter a year like 2026'}>{(id) => <Input id={id} inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value)} />}</Field>}
            {period === 'custom' && (
              <>
                <Field label="From">{(id) => <Input id={id} type="date" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />}</Field>
                <Field label="To" error={custom.from && custom.to && custom.from > custom.to ? 'Must be after the start date' : undefined}>{(id) => <Input id={id} type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />}</Field>
              </>
            )}
            <Field label="Contents">{(id) => <Select id={id} value={scope} onChange={(e) => setScope(e.target.value)}>{SCOPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>}</Field>
          </div>
        </div>
      </Section>

      <Section title={preview.data ? `Preview · ${preview.data.meta.label}` : 'Preview'} className="mb-6">
        {!valid ? <p className="text-sm text-muted">Choose a valid period to see a preview.</p>
          : preview.isError && !preview.data ? <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
          : !s ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
                <Stat label="Opening balance" value={<Money paise={s.openingPaise} />} />
                <Stat label="Income" value={<Money paise={s.incomePaise} />} />
                <Stat label="Spent" value={<Money paise={s.expensesPaise} />} hint={s.feePaymentsPaise > 0 ? <>incl. fees <Money paise={s.feePaymentsPaise} /></> : undefined} />
                <Stat label="Closing balance" value={<Money paise={s.closingPaise} />} />
              </div>
              {preview.data!.categories.length > 0 && (
                <ul className="mt-5 divide-y divide-line border-t border-line">
                  {preview.data!.categories.slice(0, 5).map((c) => (
                    <li key={c.category} className="flex justify-between py-2 text-sm"><span>{c.category}</span><Money paise={c.totalPaise} className="text-muted" /></li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted">{preview.data!.transactionCount} transactions in this period.</p>
            </>
          )}
      </Section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Section>
          <FileText className="mb-3 h-5 w-5 text-muted" aria-hidden />
          <h3 className="text-sm font-semibold">PDF report</h3>
          <p className="mb-4 mt-1 text-sm text-muted">Summary, categories, transactions, upcoming payments and savings.</p>
          <Button className="w-full" disabled={!valid || (busy !== null && busy !== 'pdf')} loading={busy === 'pdf'} onClick={() => void download('pdf')}>Download PDF</Button>
        </Section>
        <Section>
          <FileSpreadsheet className="mb-3 h-5 w-5 text-muted" aria-hidden />
          <h3 className="text-sm font-semibold">Excel workbook</h3>
          <p className="mb-4 mt-1 text-sm text-muted">Separate sheets for income, expenses, fees, loans, budgets and savings.</p>
          <Button className="w-full" disabled={!valid || (busy !== null && busy !== 'xlsx')} loading={busy === 'xlsx'} onClick={() => void download('xlsx')}>Download Excel</Button>
        </Section>
        <Section>
          <Table2 className="mb-3 h-5 w-5 text-muted" aria-hidden />
          <h3 className="text-sm font-semibold">CSV</h3>
          <p className="mb-3 mt-1 text-sm text-muted">One table at a time, for any spreadsheet app.</p>
          <Select aria-label="CSV table" value={csvSection} onChange={(e) => setCsvSection(e.target.value)} className="mb-3">{CSV_SECTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
          <Button className="w-full" disabled={!valid || (busy !== null && busy !== 'csv')} loading={busy === 'csv'} onClick={() => void download('csv')}>Download CSV</Button>
        </Section>
      </div>
    </>
  );
}
