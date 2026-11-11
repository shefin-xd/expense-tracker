import { formatDateIST } from '../utils/dates';
import { paiseToRupees } from '../utils/money';
import type { Table } from './report.tables';

/** Spreadsheet apps run text starting with these characters as formulas ("CSV injection"). */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(kind: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (kind === 'money') return paiseToRupees(v as number);
  if (kind === 'date') return formatDateIST(v as Date, 'YYYY-MM-DD');
  if (kind === 'int' || kind === 'percent') return String(v);
  let text = String(v);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 with BOM so Excel opens it correctly; amounts are plain rupees ("1250.50"), dates are ISO. */
export function tableToCsv(t: Table): string {
  const head = t.columns.map((c) => cell('text', c.header)).join(',');
  const body = t.rows.map((r) => t.columns.map((c) => cell(c.kind, r[c.key])).join(','));
  return `\uFEFF${[head, ...body].join('\r\n')}\r\n`;
}
