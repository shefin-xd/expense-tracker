import ExcelJS from 'exceljs';
import { excelDateIST, formatDateIST } from '../utils/dates';
import { paiseToRupees } from '../utils/money';
import { guardFormula } from './csv';
import type { Report } from '../services/report.service';

const NAVY = 'FF142B52';
const INK = 'FF090B10';
// Indian digit grouping (lakh/crore) with the rupee sign.
const INR_FORMAT = '[>=10000000]"₹"##\\,##\\,##\\,##0.00;[>=100000]"₹"##\\,##\\,##0.00;"₹"##,##0.00';
const DATE_FORMAT = 'dd/mm/yyyy';

type Col = { header: string; width: number; type?: 'text' | 'money' | 'date' };
type Row = (string | number | Date | null)[]; // money cells hold paise

const rupees = (paise: number) => Number(paiseToRupees(paise));

/** Writes a header + data table at startRow; returns the next free row. Money columns get a SUM total. */
function table(ws: ExcelJS.Worksheet, startRow: number, cols: Col[], rows: Row[], opts: { filter?: boolean; totals?: boolean } = {}): number {
  const head = ws.getRow(startRow);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { vertical: 'middle', horizontal: c.type === 'money' ? 'right' : 'left' };
    ws.getColumn(i + 1).width = Math.max(ws.getColumn(i + 1).width ?? 0, c.width);
  });
  head.height = 20;

  rows.forEach((r, ri) => {
    const row = ws.getRow(startRow + 1 + ri);
    cols.forEach((c, ci) => {
      const v = r[ci] ?? null;
      const cell = row.getCell(ci + 1);
      if (c.type === 'money') { cell.value = typeof v === 'number' ? rupees(v) : null; cell.numFmt = INR_FORMAT; }
      else if (c.type === 'date') { cell.value = v instanceof Date ? excelDateIST(v) : null; cell.numFmt = DATE_FORMAT; cell.alignment = { horizontal: 'left' }; }
      else cell.value = typeof v === 'string' ? guardFormula(v) : v instanceof Date ? formatDateIST(v) : v;
    });
  });

  const last = startRow + rows.length;
  if (opts.filter && rows.length) ws.autoFilter = { from: { row: startRow, column: 1 }, to: { row: last, column: cols.length } };
  if (opts.totals && rows.length) {
    const tr = ws.getRow(last + 1);
    tr.getCell(1).value = 'Total';
    cols.forEach((c, ci) => {
      if (c.type !== 'money') return;
      const L = ws.getColumn(ci + 1).letter;
      const cell = tr.getCell(ci + 1);
      cell.value = { formula: `SUM(${L}${startRow + 1}:${L}${last})`, result: rupees(rows.reduce((s, r) => s + (typeof r[ci] === 'number' ? (r[ci] as number) : 0), 0)) };
      cell.numFmt = INR_FORMAT;
    });
    tr.font = { bold: true };
    tr.eachCell((cell) => { cell.border = { top: { style: 'thin', color: { argb: INK } } }; });
    return last + 3;
  }
  return last + 3;
}

const section = (ws: ExcelJS.Worksheet, row: number, text: string) => {
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { bold: true, size: 12, color: { argb: NAVY } };
  return row + 1;
};

const status = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export async function reportToXlsx(r: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CampusLedger';
  wb.created = r.generatedAt;
  const sheet = (name: string) => wb.addWorksheet(name, { views: [{ showGridLines: false }] });

  // 1. Dashboard summary
  const s = sheet('Dashboard Summary');
  s.getColumn(1).width = 30; s.getColumn(2).width = 34;
  s.getCell('A1').value = `CampusLedger – ${r.title}`;
  s.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } };
  const info: [string, string][] = [
    ['Name', r.user.name], ['College', r.user.college ?? ''], ['Department', r.user.department], ['Year', r.user.studentYear], ['Hostel', r.user.hostel ?? ''],
    ['Period', `${formatDateIST(r.range.from)} to ${formatDateIST(r.range.to)}`], ['Generated', formatDateIST(r.generatedAt)],
  ];
  info.forEach(([k, v], i) => { s.getCell(3 + i, 1).value = k; s.getCell(3 + i, 1).font = { bold: true }; s.getCell(3 + i, 2).value = guardFormula(v); });
  const money: [string, number][] = [
    ['Opening balance', r.summary.openingPaise], ['Total income', r.summary.incomePaise], ['Total expenses', r.summary.expensesPaise], ['Remaining balance', r.summary.closingPaise],
    ['Friends owe you', r.summary.lentOutstandingPaise], ['You owe friends', r.summary.borrowedOutstandingPaise], ['Total saved (goals)', r.summary.savedPaise],
  ];
  money.forEach(([k, v], i) => {
    s.getCell(12 + i, 1).value = k; s.getCell(12 + i, 1).font = { bold: true };
    const c = s.getCell(12 + i, 2); c.value = rupees(v); c.numFmt = INR_FORMAT; c.alignment = { horizontal: 'left' };
  });
  let next = table(s, 21, [{ header: 'Category', width: 30 }, { header: 'Spent', width: 34, type: 'money' }, { header: 'Share %', width: 12 }], r.categorySpending.map((c) => [c.category, c.totalPaise, c.percent]), { totals: true });
  void next;

  // 2. Income
  const inc = sheet('Income');
  table(inc, 1, [{ header: 'Date', width: 14, type: 'date' }, { header: 'Source', width: 26 }, { header: 'Description', width: 34 }, { header: 'Payment Method', width: 18 }, { header: 'Notes', width: 34 }, { header: 'Amount', width: 18, type: 'money' }],
    r.incomeRows.map((i) => [i.date, i.source, i.description, status(i.paymentMethod), i.notes, i.amountPaise]), { filter: true, totals: true });
  inc.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];

  // 3. Expenses
  const exp = sheet('Expenses');
  table(exp, 1, [{ header: 'Date', width: 14, type: 'date' }, { header: 'Title', width: 30 }, { header: 'Category', width: 18 }, { header: 'Payment Method', width: 18 }, { header: 'Description', width: 30 }, { header: 'Notes', width: 30 }, { header: 'Amount', width: 18, type: 'money' }],
    r.expenseRows.map((e) => [e.date, e.title, e.category, status(e.paymentMethod), e.description, e.notes, e.amountPaise]), { filter: true, totals: true });
  exp.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];

  // 4. Fees and payments
  const fee = sheet('Fees and Payments');
  let row = section(fee, 1, 'Fees');
  row = table(fee, row, [{ header: 'Fee', width: 30 }, { header: 'Category', width: 20 }, { header: 'Academic Year', width: 16 }, { header: 'Due Date', width: 14, type: 'date' }, { header: 'Total', width: 18, type: 'money' }, { header: 'Paid', width: 18, type: 'money' }, { header: 'Remaining', width: 18, type: 'money' }, { header: 'Status', width: 16 }],
    r.fees.map((f) => [f.title, status(f.category), f.academicYear, f.dueDate, f.totalPaise, f.paidPaise, f.remainingPaise, status(f.status)]), { filter: true, totals: true });
  row = section(fee, row, 'Payments made');
  table(fee, row, [{ header: 'Date', width: 30 }, { header: 'Fee', width: 20 }, { header: 'Reference', width: 16 }, { header: 'Notes', width: 14 }, { header: 'Amount', width: 18, type: 'money' }],
    r.feePayments.map((p) => [formatDateIST(p.date), p.feeTitle, p.referenceNo, p.notes, p.amountPaise]), { totals: true });

  // 5 & 6. Borrowed / Lent
  for (const [name, list] of [['Borrowed Money', r.borrowed], ['Lent Money', r.lent]] as const) {
    const ws = sheet(name);
    table(ws, 1, [{ header: 'Person', width: 26 }, { header: 'Date', width: 14, type: 'date' }, { header: 'Expected Repayment', width: 20, type: 'date' }, { header: 'Amount', width: 18, type: 'money' }, { header: 'Settled', width: 18, type: 'money' }, { header: 'Remaining', width: 18, type: 'money' }, { header: 'Status', width: 18 }, { header: 'Notes', width: 30 }],
      list.map((l) => [l.person, l.date, l.expectedDate, l.amountPaise, l.repaidPaise, l.remainingPaise, status(l.status), l.notes]), { filter: true, totals: true });
    ws.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  }

  // 7. Budgets and savings
  const bs = sheet('Budgets and Savings');
  let br = section(bs, 1, 'Budgets');
  const budgetRows: Row[] = r.budgets.flatMap((b) => [
    ...(b.overall ? [[b.month, 'Overall', b.overall.limitPaise, b.overall.spentPaise, b.overall.remainingPaise, status(b.overall.level)] as Row] : []),
    ...b.categories.map((c) => [b.month, c.category, c.limitPaise, c.spentPaise, c.remainingPaise, status(c.level)] as Row),
  ]);
  br = table(bs, br, [{ header: 'Month', width: 22 }, { header: 'Category', width: 22 }, { header: 'Limit', width: 18, type: 'money' }, { header: 'Spent', width: 18, type: 'money' }, { header: 'Remaining', width: 18, type: 'money' }, { header: 'Level', width: 14 }], budgetRows, { filter: true });
  br = section(bs, br, 'Savings goals');
  table(bs, br, [{ header: 'Goal', width: 22 }, { header: 'Target Date', width: 22, type: 'date' }, { header: 'Target', width: 18, type: 'money' }, { header: 'Saved', width: 18, type: 'money' }, { header: 'Description', width: 18 }],
    r.savings.map((g) => [g.name, g.targetDate, g.targetPaise, g.savedPaise, g.description]), { totals: true });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
