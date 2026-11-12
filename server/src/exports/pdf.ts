import PDFDocument from 'pdfkit';
import { formatDateIST } from '../utils/dates';
import { formatINR } from '../utils/money';
import type { Report } from '../services/report.service';

const INK = '#090B10';
const NAVY = '#142B52';
const MUTED = '#6B7280';
const RULE = '#E5E7EB';
const MARGIN = 48;

// Built-in PDF fonts have no ₹ glyph, so the PDF writes "Rs." (spreadsheets use ₹).
const rs = (paise: number) => formatINR(paise).replace('₹', 'Rs. ');
const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

type Col = { label: string; width: number; align?: 'left' | 'right' };

export function reportToPdf(r: Report): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true, info: { Title: `${r.title} – ${r.label}`, Author: 'CampusLedger', Subject: r.user.name } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - MARGIN * 2;
    const bottom = () => doc.page.height - 64;
    const ensure = (h: number) => { if (doc.y + h > bottom()) doc.addPage(); };

    // ── Header
    doc.rect(0, 0, doc.page.width, 6).fill(NAVY);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9).text('CAMPUSLEDGER', MARGIN, 30, { characterSpacing: 1.5 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text(r.title, MARGIN, 46);
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED);
    doc.text(`${r.user.name}${r.user.department ? ` · ${r.user.department}` : ''}${r.user.studentYear ? ` · ${r.user.studentYear}` : ''}`, MARGIN, 74);
    if (r.user.college || r.user.hostel) doc.text([r.user.college, r.user.hostel].filter(Boolean).join(' · '), MARGIN, doc.y);
    doc.text(`Period: ${formatDateIST(r.range.from)} to ${formatDateIST(r.range.to)}   ·   Generated: ${formatDateIST(r.generatedAt)}`, MARGIN, doc.y);
    doc.moveDown(1);

    const heading = (text: string) => {
      ensure(60);
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY).text(text, MARGIN, doc.y);
      doc.moveTo(MARGIN, doc.y + 3).lineTo(MARGIN + W, doc.y + 3).strokeColor(NAVY).lineWidth(0.8).stroke();
      doc.moveDown(0.6);
    };

    const table = (cols: Col[], rows: string[][], emptyText: string) => {
      const rowH = 16;
      const header = () => {
        let x = MARGIN;
        doc.rect(MARGIN, doc.y, W, rowH).fill(NAVY);
        const y = doc.y;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
        for (const c of cols) { doc.text(c.label, x + 4, y + 4.5, { width: c.width - 8, height: 10, ellipsis: true, align: c.align ?? 'left' }); x += c.width; }
        doc.y = y + rowH;
      };
      if (!rows.length) { doc.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text(emptyText, MARGIN, doc.y); doc.moveDown(0.5); return; }
      ensure(rowH * 3);
      header();
      rows.forEach((row, ri) => {
        if (doc.y + rowH > bottom()) { doc.addPage(); header(); }
        const y = doc.y;
        if (ri % 2 === 1) doc.rect(MARGIN, y, W, rowH).fill('#F7F8FA');
        let x = MARGIN;
        doc.font('Helvetica').fontSize(8).fillColor(INK);
        cols.forEach((c, ci) => { doc.text(row[ci] ?? '', x + 4, y + 4.5, { width: c.width - 8, height: 10, ellipsis: true, align: c.align ?? 'left' }); x += c.width; });
        doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + W, y + rowH).strokeColor(RULE).lineWidth(0.4).stroke();
        doc.y = y + rowH;
      });
      doc.moveDown(0.5);
    };

    // ── Summary
    heading('Summary');
    const boxes: [string, string][] = [
      ['Opening balance', rs(r.summary.openingPaise)], ['Total income', rs(r.summary.incomePaise)],
      ['Total expenses', rs(r.summary.expensesPaise)], ['Remaining balance', rs(r.summary.closingPaise)],
    ];
    const bw = W / 4;
    const by = doc.y;
    boxes.forEach(([k, v], i) => {
      const x = MARGIN + i * bw;
      doc.rect(x, by, bw - 6, 46).lineWidth(0.6).strokeColor(RULE).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(k, x + 8, by + 8, { width: bw - 22 });
      doc.font('Helvetica-Bold').fontSize(i === 3 ? 12 : 11).fillColor(i === 3 ? NAVY : INK).text(v, x + 8, by + 24, { width: bw - 22, lineBreak: false });
    });
    doc.y = by + 58;
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(`Friends owe you ${rs(r.summary.lentOutstandingPaise)}   ·   You owe friends ${rs(r.summary.borrowedOutstandingPaise)}   ·   Saved in goals ${rs(r.summary.savedPaise)}`, MARGIN, doc.y);
    doc.moveDown(0.3);

    const full = r.type === 'monthly' || r.type === 'yearly' || r.type === 'custom';

    // ── Category-wise spending
    if (full || r.type === 'expenses') {
      heading('Category-wise spending');
      table([{ label: 'Category', width: W - 230 }, { label: 'Entries', width: 70, align: 'right' }, { label: 'Share', width: 60, align: 'right' }, { label: 'Amount', width: 100, align: 'right' }],
        r.categorySpending.map((c) => [c.category, String(c.count), `${c.percent}%`, rs(c.totalPaise)]), 'No expenses in this period.');
    }

    if (r.type === 'income') {
      heading('Income by source');
      table([{ label: 'Source', width: W - 100 }, { label: 'Amount', width: 100, align: 'right' }], r.incomeBySource.map((i) => [i.label, rs(i.totalPaise)]), 'No income in this period.');
      heading('Income records');
      table([{ label: 'Date', width: 65 }, { label: 'Source', width: 130 }, { label: 'Description', width: W - 65 - 130 - 70 - 100 }, { label: 'Method', width: 70 }, { label: 'Amount', width: 100, align: 'right' }],
        r.incomeRows.map((i) => [formatDateIST(i.date), i.source, i.description, label(i.paymentMethod), rs(i.amountPaise)]), 'No income in this period.');
    }

    if (r.type === 'expenses') {
      heading('Expense records');
      table([{ label: 'Date', width: 65 }, { label: 'Title', width: W - 65 - 95 - 75 - 90 }, { label: 'Category', width: 95 }, { label: 'Method', width: 75 }, { label: 'Amount', width: 90, align: 'right' }],
        r.expenseRows.map((e) => [formatDateIST(e.date), e.title, e.category, label(e.paymentMethod), rs(e.amountPaise)]), 'No expenses in this period.');
    }

    if (full) {
      heading('Transaction history');
      table([{ label: 'Date', width: 62 }, { label: 'Title', width: W - 62 - 90 - 90 - 90 }, { label: 'Category', width: 90 }, { label: 'In', width: 90, align: 'right' }, { label: 'Out', width: 90, align: 'right' }],
        r.transactions.map((t) => [formatDateIST(t.date), t.title, t.category, t.inPaise ? rs(t.inPaise) : '', t.outPaise ? rs(t.outPaise) : '']), 'No transactions in this period.');
      if (r.transactionsTruncated) doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED).text('Showing the first 10,000 transactions. Use a shorter period or the spreadsheet export for the rest.', MARGIN, doc.y);
    }

    if (r.type === 'fees') {
      heading('Fees');
      table([{ label: 'Fee', width: W - 60 - 70 - 90 - 90 - 90 - 70 }, { label: 'Year', width: 60 }, { label: 'Due', width: 70 }, { label: 'Total', width: 90, align: 'right' }, { label: 'Paid', width: 90, align: 'right' }, { label: 'Remaining', width: 90, align: 'right' }, { label: 'Status', width: 70 }],
        r.fees.map((f) => [f.title, f.academicYear, formatDateIST(f.dueDate), rs(f.totalPaise), rs(f.paidPaise), rs(f.remainingPaise), label(f.status)]), 'No fees recorded.');
      heading('Payments made');
      table([{ label: 'Date', width: 65 }, { label: 'Fee', width: W - 65 - 100 - 100 }, { label: 'Reference', width: 100 }, { label: 'Amount', width: 100, align: 'right' }],
        r.feePayments.map((p) => [formatDateIST(p.date), p.feeTitle, p.referenceNo, rs(p.amountPaise)]), 'No payments recorded.');
    }

    // ── Upcoming payments
    if (full || r.type === 'fees') {
      heading('Upcoming payments');
      const rows = [
        ...r.upcoming.fees.map((f) => [formatDateIST(f.dueDate), `Fee: ${f.title}`, label(f.status), rs(f.remainingPaise)]),
        ...r.upcoming.repayments.map((l) => [formatDateIST(l.expectedDate), l.direction === 'lent' ? `${l.person} to repay you` : `Repay ${l.person}`, label(l.status), rs(l.remainingPaise)]),
      ].sort((a, b) => a[0]!.split('/').reverse().join().localeCompare(b[0]!.split('/').reverse().join()));
      table([{ label: 'Due', width: 65 }, { label: 'Item', width: W - 65 - 90 - 100 }, { label: 'Status', width: 90 }, { label: 'Amount', width: 100, align: 'right' }], rows, 'Nothing due.');
    }

    // ── Savings summary
    if (full) {
      heading('Savings summary');
      table([{ label: 'Goal', width: W - 80 - 100 - 100 - 70 }, { label: 'Target date', width: 80 }, { label: 'Saved', width: 100, align: 'right' }, { label: 'Target', width: 100, align: 'right' }, { label: 'Progress', width: 70, align: 'right' }],
        r.savings.map((g) => [g.name, g.targetDate ? formatDateIST(g.targetDate) : '', rs(g.savedPaise), rs(g.targetPaise), `${Math.min(100, Math.floor((g.savedPaise * 100) / g.targetPaise))}%`]), 'No savings goals yet.');
    }

    // ── Footer on every page
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0; // allow writing in the footer area without auto page-break
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`CampusLedger · ${r.user.name} · Page ${i + 1} of ${range.count}`, MARGIN, doc.page.height - 36, { width: W, align: 'center', lineBreak: false });
    }
    doc.end();
  });
}
