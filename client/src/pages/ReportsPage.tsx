import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FilterSelect, SelectInput, TextInput } from '@/components/ui/Field';
import { PageHeader, Panel, Segmented } from '@/components/ui/Parts';
import { CSV_DATASETS, FORMATS, REPORT_TYPES, reportQuery, type Format, type PeriodMode, type ReportType } from '@/features/reports/params';
import { api } from '@/services/api';
import { errorMessage } from '@/services/queries';
import { toast } from '@/store/toast';
import { currentMonthKey, todayKey } from '@/utils/date';
import { rangeDays } from '@/utils/ranges';
import { useQueryClient } from '@tanstack/react-query';

export default function ReportsPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<ReportType>('monthly');
  const [mode, setMode] = useState<PeriodMode>('month');
  const [month, setMonth] = useState(currentMonthKey());
  const [year, setYear] = useState(Number(todayKey().slice(0, 4)));
  const [from, setFrom] = useState(rangeDays('month').from);
  const [to, setTo] = useState(todayKey());
  const [academicYear, setAcademicYear] = useState('');
  const [dataset, setDataset] = useState('transactions');
  const [busy, setBusy] = useState<Format | null>(null);

  const showMode = type === 'expenses' || type === 'income' || type === 'fees';
  const useMonth = type === 'monthly' || (showMode && mode === 'month');
  const useYear = type === 'yearly' || (showMode && mode === 'year');
  const useRange = type === 'custom' || (showMode && mode === 'custom');
  const badRange = useRange && (!from || !to || from > to);
  const badMonth = useMonth && !/^\d{4}-\d{2}$/.test(month);
  const badYear = useYear && !(year >= 2000 && year <= 2100);
  const invalid = badRange || badMonth || badYear;
  const spec = REPORT_TYPES.find((t) => t.value === type)!;

  async function download(format: Format) {
    setBusy(format);
    try {
      // CSV defaults to the dataset that matches the report type unless you pick another.
      const ds = format === 'csv' ? (dataset === 'transactions' && showMode ? type : dataset) : dataset;
      await api.download(`/reports/${format}`, reportQuery({ type, mode, month, year, from, to, academicYear, dataset: ds, format }), `campusledger-report.${format}`);
      toast.success(`${FORMATS.find((f) => f.value === format)!.label} report downloaded`);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Reports & Exports" description="Download your numbers as a PDF, Excel workbook or CSV." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Choose a report" className="lg:col-span-3">
          <div className="space-y-5">
            <SelectInput label="Report" hint={spec.hint} value={type} onChange={(e) => setType(e.target.value as ReportType)}>{REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</SelectInput>

            {showMode && <div><span className="mb-1.5 block text-[13px] font-medium">Period</span><Segmented label="Period type" value={mode} onChange={setMode} options={[{ value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'custom', label: 'Custom' }]} /></div>}
            {useMonth && <TextInput label="Month" type="month" value={month} max={currentMonthKey()} onChange={(e) => setMonth(e.target.value)} error={badMonth ? 'Choose a month' : undefined} />}
            {useYear && <TextInput label="Year" type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} error={badYear ? 'Enter a year between 2000 and 2100' : undefined} />}
            {useRange && (
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="From" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                <TextInput label="To" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} error={badRange && from && to ? 'End date must be on or after the start date' : undefined} />
              </div>
            )}
            {type === 'fees' && <TextInput label="Academic year (optional)" placeholder="e.g. 2026-27" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} hint="Leave empty to include every fee." />}
          </div>
        </Panel>

        <Panel title="Download" className="lg:col-span-2">
          <div className="space-y-4">
            <Field label="If you choose CSV, include">
              {(id) => <FilterSelect label="CSV contents" id={id} value={dataset} className="w-full" onChange={(e) => setDataset(e.target.value)}>{CSV_DATASETS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</FilterSelect>}
            </Field>
            <div className="grid gap-2">
              {FORMATS.map((f) => (
                <Button key={f.value} variant={f.value === 'pdf' ? 'primary' : 'secondary'} disabled={invalid} loading={busy === f.value} onClick={() => download(f.value)}>
                  <Download className="size-4" aria-hidden />Download {f.label}
                </Button>
              ))}
            </div>
            <p className="text-[13px] text-muted">Reports only ever include your own records. PDF amounts show as "Rs." and spreadsheets use ₹.</p>
          </div>
        </Panel>
      </div>
    </>
  );
}
