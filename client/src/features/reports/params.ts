export const REPORT_TYPES = [
  { value: 'monthly', label: 'Monthly report', hint: 'Everything for one month' },
  { value: 'yearly', label: 'Yearly report', hint: 'Everything for one year' },
  { value: 'custom', label: 'Custom date range', hint: 'Pick your own start and end dates' },
  { value: 'expenses', label: 'Expenses only', hint: 'Spending and categories' },
  { value: 'income', label: 'Income only', hint: 'Money received, by source' },
  { value: 'fees', label: 'Fees report', hint: 'All fees and the payments made' },
] as const;
export type ReportType = (typeof REPORT_TYPES)[number]['value'];
export type PeriodMode = 'month' | 'year' | 'custom';
export const FORMATS = [{ value: 'pdf', label: 'PDF' }, { value: 'xlsx', label: 'Excel' }, { value: 'csv', label: 'CSV' }] as const;
export type Format = (typeof FORMATS)[number]['value'];
export const CSV_DATASETS = [
  { value: 'transactions', label: 'All transactions' }, { value: 'expenses', label: 'Expenses' }, { value: 'income', label: 'Income' }, { value: 'fees', label: 'Fees' }, { value: 'loans', label: 'Lent and borrowed money' },
] as const;

/** Builds the query string the server expects for a given report choice. */
export function reportQuery(o: { type: ReportType; mode: PeriodMode; month: string; year: number; from: string; to: string; academicYear: string; dataset: string; format: Format }) {
  const q: Record<string, string | number | undefined> = { type: o.type };
  if (o.type === 'monthly') q.month = o.month;
  else if (o.type === 'yearly') q.year = o.year;
  else if (o.type === 'custom') { q.from = o.from; q.to = o.to; }
  else if (o.mode === 'month') q.month = o.month;
  else if (o.mode === 'year') q.year = o.year;
  else { q.from = o.from; q.to = o.to; }
  if (o.type === 'fees' && o.academicYear) q.academicYear = o.academicYear;
  if (o.format === 'csv') q.dataset = o.dataset;
  return q;
}
