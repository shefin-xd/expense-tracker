import ExcelJS from 'exceljs';
import { istDateAsUtc, type DateFormat } from '../utils/dates';
import { paiseToRupees } from '../utils/money';
import type { ReportData } from './report.service';
import { buildTables, sumColumn, type Col, type Table } from './report.tables';

const INK = 'FF090B10';
const BLUE = 'FF142B52';
const RULE = 'FFE5E7EB';
const MONEY_FMT = '"₹"#,##0.00;[Red]-"₹"#,##0.00';
const DATE_FMT: Record<DateFormat, string> = { 'DD/MM/YYYY': 'dd/mm/yyyy', 'MM/DD/YYYY': 'mm/dd/yyyy', 'YYYY-MM-DD': 'yyyy-mm-dd' };
const rupees = (paise: number) => Number(paiseToRupees(paise)); // display value only; all sums come from integer paise

const colLetter = (n: number) => String.fromCharCode(64 + n);

function writeTable(ws: ExcelJS.Worksheet, startRow: number, t: Table, fmt: DateFormat, opts: { filter: boolean; title?: boolean }): number {
  let r = startRow;
  if (opts.title !== false) {
    const tc = ws.getCell(r, 1);
    tc.value = t.title;
    tc.font = { name: 'Calibri', size: 12, bold: true, color: { argb: BLUE } };
    r += 1;
  }
  const headerRow = r;
  t.columns.forEach((c, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    cell.alignment = { vertical: 'middle', horizontal: c.kind === 'text' || c.kind === 'date' ? 'left' : 'right' };
    ws.getColumn(i + 1).width = Math.max(ws.getColumn(i + 1).width ?? 0, c.width);
  });
  r += 1;
  const first = r;
  for (const row of t.rows) {
    t.columns.forEach((c, i) => {
      const v = row[c.key];
      const cell = ws.getCell(r, i + 1);
      if (v === null || v === undefined || v === '') return;
      if (c.kind === 'money') { cell.value = rupees(v as number); cell.numFmt = MONEY_FMT; }
      else if (c.kind === 'date') { cell.value = istDateAsUtc(v as Date); cell.numFmt = DATE_FMT[fmt]; cell.alignment = { horizontal: 'left' }; }
      else if (c.kind === 'percent') { cell.value = v as number; cell.numFmt = '0.0"%"'; }
      else if (c.kind === 'int') cell.value = v as number;
      else cell.value = String(v); // strings are stored as text, never evaluated as formulas
      cell.border = { bottom: { style: 'hair', color: { argb: RULE } } };
    });
    r += 1;
  }
  const last = r - 1;
  if (opts.filter && t.rows.length) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: last, column: t.columns.length } };
  if (t.rows.length && t.columns.some((c) => c.total)) {
    ws.getCell(r, 1).value = 'Total';
    t.columns.forEach((c: Col, i) => {
      if (!c.total) return;
      const L = colLetter(i + 1);
      const cell = ws.getCell(r, i + 1);
      cell.value = { formula: `SUBTOTAL(109,${L}${first}:${L}${last})`, result: rupees(sumColumn(t, c.key)) };
      cell.numFmt = MONEY_FMT;
    });
    for (let i = 1; i <= t.columns.length; i++) {
      const cell = ws.getCell(r, i);
      cell.font = { bold: true, color: { argb: INK } };
      cell.border = { top: { style: 'thin', color: { argb: INK } } };
    }
    r += 1;
  }
  if (!t.rows.length) { ws.getCell(r, 1).value = 'No records'; ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF6B7280' } }; r += 1; }
  return r + 1;
}

export async function buildWorkbook(d: ReportData): Promise<Buffer> {
  const tables = buildTables(d);
  const fmt = d.meta.dateFormat;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CampusLedger';
  wb.created = d.meta.generatedAt;
  const add = (name: string, tabs: Table[], opts: { header?: boolean } = {}) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: opts.header ? 5 : 2 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    if (opts.header) {
      ws.getCell('A1').value = 'CampusLedger financial report';
      ws.getCell('A1').font = { size: 16, bold: true, color: { argb: BLUE } };
      ws.getCell('A2').value = `${d.meta.user.name} · ${d.meta.label}`;
      ws.getCell('A3').value = `Generated ${d.meta.generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
      ws.getCell('A3').font = { color: { argb: 'FF6B7280' } };
    }
    let row = opts.header ? 5 : 1;
    tabs.forEach((t, i) => { row = writeTable(ws, row, t, fmt, { filter: i === 0, title: tabs.length > 1 || !!opts.header }); });
    if (!opts.header) ws.views = [{ state: 'frozen', ySplit: tabs.length > 1 ? 2 : 1 }];
    return ws;
  };

  const sc = d.meta.scope;
  add('Dashboard Summary', sc === 'expenses' || sc === 'all' ? [tables.summary, tables.categories] : [tables.summary], { header: true });
  if (sc === 'all' || sc === 'income') add('Income', [tables.income]);
  if (sc === 'all' || sc === 'expenses') add('Expenses', [tables.expenses]);
  if (sc === 'all' || sc === 'fees') add('Fees and Payments', [tables.fees, tables.fee_payments]);
  if (sc === 'all') {
    add('Borrowed Money', [tables.borrowed]);
    add('Lent Money', [tables.lent]);
    add('Budgets and Savings', [tables.budgets, tables.savings]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
