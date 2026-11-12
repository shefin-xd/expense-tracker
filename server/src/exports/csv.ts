import { formatDateIST } from '../utils/dates';
import { paiseToRupees } from '../utils/money';
import type { Report } from '../services/report.service';

/** A numeric cell. Text cells are plain strings and get formula-injection protection. */
export type Cell = string | { num: string };
const num = (paise: number): Cell => ({ num: paiseToRupees(paise) });

/** Stops spreadsheet apps from running user text as a formula (=, +, -, @, tab, CR). */
export function guardFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function csvCell(c: Cell): string {
  const text = typeof c === 'string' ? guardFormula(c) : c.num;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Cell[][]): string {
  // BOM so Excel opens UTF-8 (names, ₹) correctly.
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const CSV_DATASETS = ['transactions', 'expenses', 'income', 'fees', 'loans'] as const;
export type CsvDataset = (typeof CSV_DATASETS)[number];

export function reportToCsv(r: Report, dataset: CsvDataset): string {
  switch (dataset) {
    case 'transactions':
      return toCsv([
        ['Date', 'Type', 'Title', 'Category', 'Money In (INR)', 'Money Out (INR)'],
        ...r.transactions.map((t) => [formatDateIST(t.date), t.kind.replace(/_/g, ' '), t.title, t.category, t.inPaise ? num(t.inPaise) : '', t.outPaise ? num(t.outPaise) : ''] as Cell[]),
      ]);
    case 'expenses':
      return toCsv([
        ['Date', 'Title', 'Category', 'Payment Method', 'Description', 'Notes', 'Amount (INR)'],
        ...r.expenseRows.map((e) => [formatDateIST(e.date), e.title, e.category, e.paymentMethod.replace(/_/g, ' '), e.description, e.notes, num(e.amountPaise)] as Cell[]),
      ]);
    case 'income':
      return toCsv([
        ['Date', 'Source', 'Description', 'Payment Method', 'Notes', 'Amount (INR)'],
        ...r.incomeRows.map((i) => [formatDateIST(i.date), i.source, i.description, i.paymentMethod.replace(/_/g, ' '), i.notes, num(i.amountPaise)] as Cell[]),
      ]);
    case 'fees':
      return toCsv([
        ['Fee', 'Category', 'Academic Year', 'Due Date', 'Total (INR)', 'Paid (INR)', 'Remaining (INR)', 'Status'],
        ...r.fees.map((f) => [f.title, f.category.replace(/_/g, ' '), f.academicYear, formatDateIST(f.dueDate), num(f.totalPaise), num(f.paidPaise), num(f.remainingPaise), f.status.replace(/_/g, ' ')] as Cell[]),
      ]);
    case 'loans':
      return toCsv([
        ['Direction', 'Person', 'Date', 'Expected Repayment', 'Amount (INR)', 'Settled (INR)', 'Remaining (INR)', 'Status'],
        ...[...r.lent.map((l) => ['Lent', l] as const), ...r.borrowed.map((l) => ['Borrowed', l] as const)].map(
          ([d, l]) => [d, l.person, formatDateIST(l.date), l.expectedDate ? formatDateIST(l.expectedDate) : '', num(l.amountPaise), num(l.repaidPaise), num(l.remainingPaise), l.status.replace(/_/g, ' ')] as Cell[],
        ),
      ]);
  }
}
