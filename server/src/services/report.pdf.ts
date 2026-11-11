import path from 'node:path';
import PDFDocument from 'pdfkit';
import { formatDateIST } from '../utils/dates';
import { formatINR } from '../utils/money';
import type { ReportData } from './report.service';
import { buildTables, sumColumn, type Col, type Table } from './report.tables';

const INK = '#090B10';
const BLUE = '#142B52';
const MUTED = '#6B7280';
const RULE = '#E5E7EB';
const ZEBRA = '#F6F7F9';
const MAX_PDF_ROWS = 2000; // keep the PDF readable; the XLSX/CSV exports hold everything

// Inter is embedded because the built-in PDF fonts have no ₹ glyph.
const FONT_DIR = path.resolve(__dirname, '../../assets/fonts');
const REGULAR = path.join(FONT_DIR, 'Inter_400Regular.ttf');
const SEMI = path.join(FONT_DIR, 'Inter_600SemiBold.ttf');

const M = 40;
const ROW_H = 19;

export function reportTitle(d: ReportData): string {
  if (d.meta.scope === 'expenses') return 'Expense report';
  if (d.meta.scope === 'income') return 'Income report';
  if (d.meta.scope === 'fees') return 'Fee report';
  return d.meta.period === 'month' ? 'Monthly report' : d.meta.period === 'year' ? 'Yearly report' : 'Custom range report';
}

export function buildPdf(d: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true, compress: process.env.NODE_ENV !== 'test', info: { Title: `${reportTitle(d)} – ${d.meta.label}`, Author: 'CampusLedger', Subject: 'Personal financial report' } });
    doc.registerFont('R', REGULAR);
    doc.registerFont('S', SEMI);
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      render(doc, d);
      addFooters(doc, d);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

const W = () => 595.28 - M * 2;
const bottom = (doc: PDFKit.PDFDocument) => doc.page.height - 56;

function ensure(doc: PDFKit.PDFDocument, y: number, need: number): number {
  if (y + need <= bottom(doc)) return y;
  doc.addPage();
  return M;
}

function heading(doc: PDFKit.PDFDocument, y: number, text: string): number {
  y = ensure(doc, y, 26 + ROW_H * 4); // keep a heading together with its first rows
  doc.font('S').fontSize(11).fillColor(BLUE).text(text, M, y, { width: W(), lineBreak: false });
  doc.moveTo(M, y + 17).lineTo(M + W(), y + 17).lineWidth(0.75).strokeColor(BLUE).stroke();
  return y + 26;
}

function fmtCell(c: Col, v: unknown, d: ReportData): string {
  if (v === null || v === undefined || v === '') return '';
  if (c.kind === 'money') return formatINR(v as number);
  if (c.kind === 'date') return formatDateIST(v as Date, d.meta.dateFormat);
  if (c.kind === 'percent') return `${(v as number).toFixed(1)}%`;
  return String(v);
}

function drawTable(doc: PDFKit.PDFDocument, y: number, t: Table, keys: string[] | null, d: ReportData, opts: { max?: number } = {}): number {
  const cols = keys ? keys.map((k) => t.columns.find((c) => c.key === k)!).filter(Boolean) : t.columns;
  const totalUnits = cols.reduce((s, c) => s + c.width, 0);
  const widths = cols.map((c) => (c.width / totalUnits) * W());
  const xs = widths.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? M : acc[i - 1]! + widths[i - 1]!], []);
  const right = (c: Col) => c.kind === 'money' || c.kind === 'int' || c.kind === 'percent';

  const header = (yy: number) => {
    doc.rect(M, yy, W(), ROW_H).fill(BLUE);
    doc.font('S').fontSize(8).fillColor('#FFFFFF');
    cols.forEach((c, i) => doc.text(c.header, xs[i]! + 5, yy + 6, { width: widths[i]! - 10, height: 10, ellipsis: true, align: right(c) ? 'right' : 'left' }));
    return yy + ROW_H;
  };

  if (!t.rows.length) {
    doc.font('R').fontSize(9).fillColor(MUTED).text('No records for this period.', M, y, { width: W() });
    return y + 22;
  }

  y = ensure(doc, y, ROW_H * 3);
  y = header(y);
  const rows = t.rows.slice(0, opts.max ?? t.rows.length);
  rows.forEach((row, n) => {
    if (y + ROW_H > bottom(doc)) { doc.addPage(); y = header(M); }
    if (n % 2 === 1) doc.rect(M, y, W(), ROW_H).fill(ZEBRA);
    doc.font('R').fontSize(8.5).fillColor(INK);
    cols.forEach((c, i) => doc.text(fmtCell(c, row[c.key], d), xs[i]! + 5, y + 5.5, { width: widths[i]! - 10, height: 11, ellipsis: true, align: right(c) ? 'right' : 'left' }));
    y += ROW_H;
  });

  if (cols.some((c) => c.total)) {
    if (y + ROW_H > bottom(doc)) { doc.addPage(); y = M; }
    doc.moveTo(M, y).lineTo(M + W(), y).lineWidth(0.75).strokeColor(INK).stroke();
    doc.font('S').fontSize(8.5).fillColor(INK).text(t.rows.length > rows.length ? 'Total (all rows)' : 'Total', M + 5, y + 5.5, { width: widths[0]! - 10, lineBreak: false });
    cols.forEach((c, i) => { if (c.total) doc.text(formatINR(sumColumn(t, c.key)), xs[i]! + 5, y + 5.5, { width: widths[i]! - 10, height: 11, align: 'right' }); });
    y += ROW_H;
  }
  if (t.rows.length > rows.length) {
    doc.font('R').fontSize(8).fillColor(MUTED).text(`Showing the first ${rows.length} of ${t.rows.length} rows. Export to Excel or CSV for the complete list.`, M, y + 4, { width: W() });
    y += 18;
  }
  return y + 14;
}

function render(doc: PDFKit.PDFDocument, d: ReportData) {
  const T = buildTables(d);
  const { user } = d.meta;

  // Masthead
  doc.font('S').fontSize(11).fillColor(BLUE).text('CampusLedger', M, M, { lineBreak: false });
  doc.font('R').fontSize(9).fillColor(MUTED).text('Personal financial report', M, M + 2, { width: W(), align: 'right', lineBreak: false });
  doc.moveTo(M, M + 22).lineTo(M + W(), M + 22).lineWidth(0.5).strokeColor(RULE).stroke();

  doc.font('S').fontSize(22).fillColor(INK).text(reportTitle(d), M, M + 38, { width: W(), lineBreak: false });
  doc.font('R').fontSize(12).fillColor(BLUE).text(d.meta.label, M, M + 68, { width: W(), lineBreak: false });

  const details = [
    user.name,
    [user.department, user.studentYear].filter(Boolean).join(' · '),
    [user.college, user.hostel].filter(Boolean).join(' · '),
    `Period: ${formatDateIST(d.meta.from, d.meta.dateFormat)} to ${formatDateIST(d.meta.to, d.meta.dateFormat)}   ·   Generated: ${formatDateIST(d.meta.generatedAt, d.meta.dateFormat)}`,
  ].filter(Boolean);
  let y = M + 92;
  details.forEach((line, i) => {
    doc.font(i === 0 ? 'S' : 'R').fontSize(i === 0 ? 10 : 9).fillColor(i === 0 ? INK : MUTED).text(line, M, y, { width: W(), lineBreak: false });
    y += 14;
  });
  y += 10;

  // Key figures
  const cards: [string, number, boolean][] = [
    ['Opening balance', d.summary.openingPaise, false],
    ['Total income', d.summary.incomePaise, false],
    ['Total expenses', d.summary.expensesPaise, false],
    ['Remaining balance', d.summary.closingPaise, true],
  ];
  const gap = 8;
  const cw = (W() - gap * 3) / 4;
  cards.forEach(([label, value, strong], i) => {
    const x = M + i * (cw + gap);
    if (strong) doc.rect(x, y, cw, 52).fill(BLUE);
    else doc.rect(x, y, cw, 52).lineWidth(0.75).strokeColor(RULE).stroke();
    doc.font('R').fontSize(8).fillColor(strong ? '#C7D2E6' : MUTED).text(label, x + 10, y + 10, { width: cw - 20, lineBreak: false });
    doc.font('S').fontSize(12.5).fillColor(strong ? '#FFFFFF' : INK).text(formatINR(value), x + 10, y + 27, { width: cw - 20, lineBreak: false });
  });
  y += 52 + 22;

  const sc = d.meta.scope;

  if (sc === 'all' || sc === 'expenses') {
    y = heading(doc, y, 'Spending by category');
    if (!d.categories.length) { doc.font('R').fontSize(9).fillColor(MUTED).text('No expenses in this period.', M, y); y += 24; }
    for (const c of d.categories) {
      y = ensure(doc, y, 26);
      doc.font('R').fontSize(9).fillColor(INK).text(c.category, M, y, { width: 150, height: 11, ellipsis: true });
      doc.rect(M + 160, y + 2, 230, 7).fill(ZEBRA);
      doc.rect(M + 160, y + 2, Math.max(1.5, (230 * c.share) / 100), 7).fill(BLUE);
      doc.font('R').fontSize(9).fillColor(MUTED).text(`${c.share.toFixed(1)}%`, M + 396, y, { width: 40, align: 'right', lineBreak: false });
      doc.font('S').fontSize(9).fillColor(INK).text(formatINR(c.totalPaise), M + 440, y, { width: W() - 440, align: 'right', lineBreak: false });
      y += 19;
    }
    y += 10;
  }

  if (sc === 'all' || sc === 'income') {
    y = heading(doc, y, 'Income by source');
    const tbl: Table = {
      id: 'categories', title: 'Income by source',
      columns: [{ header: 'Source', key: 'source', kind: 'text', width: 30 }, { header: 'Entries', key: 'count', kind: 'int', width: 10 }, { header: 'Total', key: 'totalPaise', kind: 'money', width: 18, total: true }],
      rows: T.income.rows.length ? groupIncome(T) : [],
    };
    y = drawTable(doc, y, tbl, null, d);
  }

  if (sc === 'fees') {
    y = heading(doc, y, 'Fees');
    y = drawTable(doc, y, T.fees, ['title', 'category', 'totalPaise', 'paidPaise', 'remainingPaise', 'dueDate', 'status'], d);
    y = heading(doc, y, 'Fee payments in this period');
    y = drawTable(doc, y, T.fee_payments, ['date', 'fee', 'amountPaise', 'referenceNo'], d);
  }

  y = heading(doc, y, `Transaction history (${d.transactionCount})`);
  y = drawTable(doc, y, T.transactions, null, d, { max: MAX_PDF_ROWS });

  if (sc === 'all') {
    y = heading(doc, y, 'Upcoming payments');
    const unpaid = { ...T.fees, rows: T.fees.rows.filter((r) => r.status !== 'Paid') };
    y = drawTable(doc, y, unpaid, ['title', 'dueDate', 'remainingPaise', 'status'], d);
    if (d.upcoming.repayments.length) {
      const rep: Table = {
        id: 'lent', title: 'Repayments',
        columns: [
          { header: 'Friend', key: 'person', kind: 'text', width: 22 }, { header: 'Direction', key: 'direction', kind: 'text', width: 16 },
          { header: 'Expected date', key: 'expectedDate', kind: 'date', width: 14 }, { header: 'Remaining', key: 'remainingPaise', kind: 'money', width: 14 },
        ],
        rows: d.upcoming.repayments.map((r) => ({ ...r, direction: r.direction === 'lent' ? 'Owes you' : 'You owe' })),
      };
      y = drawTable(doc, y, rep, null, d);
    }

    y = heading(doc, y, 'Savings summary');
    y = drawTable(doc, y, T.savings, ['name', 'targetPaise', 'savedPaise', 'remainingPaise', 'percent'], d);
  }
}

function groupIncome(T: Record<string, Table>): Record<string, unknown>[] {
  const by = new Map<string, { source: unknown; count: number; totalPaise: number }>();
  for (const r of T.income!.rows) {
    const k = String(r.source);
    const cur = by.get(k) ?? { source: r.source, count: 0, totalPaise: 0 };
    cur.count += 1;
    cur.totalPaise += r.amountPaise as number;
    by.set(k, cur);
  }
  return [...by.values()].sort((a, b) => b.totalPaise - a.totalPaise);
}

function addFooters(doc: PDFKit.PDFDocument, d: ReportData) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    const saved = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // otherwise writing in the margin starts a new page
    const y = doc.page.height - 34;
    doc.moveTo(M, y - 8).lineTo(M + W(), y - 8).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.font('R').fontSize(8).fillColor(MUTED);
    doc.text(`CampusLedger · ${d.meta.user.name} · ${d.meta.label}`, M, y, { width: W() - 80, lineBreak: false });
    doc.text(`Page ${i - start + 1} of ${count}`, M + W() - 80, y, { width: 80, align: 'right', lineBreak: false });
    doc.page.margins.bottom = saved;
  }
}
