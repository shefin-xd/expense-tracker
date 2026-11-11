import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { Notification } from '../src/models/Notification';
import { CSV_SECTIONS } from '../src/validators/report.validators';
import { anonymous, clearDb, signup, startDb, stopDb, type Agent } from './helpers';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const binary = (res: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};
const getBin = (a: Agent, url: string) => a.get(url).buffer(true).parse(binary as never);
const loadWb = async (buf: unknown) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ExcelJS.Buffer);
  return wb;
};

/** Same shape of data for every user; `tag` makes each user's records recognisable. */
async function seed(a: Agent, tag: string, opts: { hostile?: boolean } = {}) {
  const post = async (url: string, body: object) => {
    const r = await a.post(url).send(body);
    expect(r.status, `${url} ${JSON.stringify(r.body)}`).toBeLessThan(300);
    return r.body.data;
  };
  await post('/api/income', { source: 'pocket_money', amount: 2000, date: '2026-09-10T10:00:00Z', description: `${tag}-sept` });
  await post('/api/income', { source: 'parents', amount: 10000, date: '2026-10-05T10:00:00Z', description: `${tag}-allowance` });
  await post('/api/expenses', { title: `${tag}-lunch`, amount: '250.50', category: 'Food', date: '2026-10-10T07:00:00Z' });
  if (opts.hostile) await post('/api/expenses', { title: '=HYPERLINK("http://evil.example","x")', amount: 10, category: 'Snacks', date: '2026-10-11T07:00:00Z' });
  // 2026-10-31 20:00 UTC is 1 Nov, 01:30 in IST, so it belongs to November.
  await post('/api/expenses', { title: `${tag}-boundary`, amount: 100, category: 'Food', date: '2026-10-31T20:00:00Z' });
  const fee = await post('/api/fees', { title: `${tag}-tuition`, category: 'tuition', academicYear: '2026-27', total: 5000, dueDate: '2026-10-20T00:00:00Z' });
  await post(`/api/fees/${fee.id}/payments`, { amount: 1200, date: '2026-10-15T10:00:00Z', referenceNo: `${tag}-REF` });
  await post('/api/lending', { person: `${tag}-Anu`, amount: 300, date: '2026-10-12T10:00:00Z' });
  await post('/api/borrowing', { person: `${tag}-Ben`, amount: 200, date: '2026-10-13T10:00:00Z' });
  expect((await a.put('/api/budgets/2026-10').send({ overall: 1000, categories: [{ category: 'Food', limit: 500 }] })).status).toBe(200);
  await post('/api/savings', { name: `${tag}-Laptop`, target: 60000, saved: 15000 });
}

const OCT = 'month=2026-10';

describe('report numbers', () => {
  it('opening, income, expenses and closing balance follow the ledger rules (IST month)', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A', { hostile: true });
    const res = await agent.get(`/api/reports/summary?${OCT}`);
    expect(res.status).toBe(200);
    const s = res.body.data.summary;
    expect(s.openingPaise).toBe(200_000); // September pocket money only
    expect(s.incomePaise).toBe(1_000_000);
    expect(s.feePaymentsPaise).toBe(120_000); // only what was actually paid, not the ₹5,000 fee
    expect(s.expensesPaise).toBe(25_050 + 1_000 + 120_000); // boundary expense is November, so excluded
    expect(s.closingPaise).toBe(200_000 + 1_000_000 - 146_050 - 30_000 + 20_000); // lend out −, borrow in +
    expect(s.netPaise).toBe(s.closingPaise - s.openingPaise);
    expect(s.lentOutstandingPaise).toBe(30_000);
    expect(s.borrowedOutstandingPaise).toBe(20_000);
    expect(s.savingsPaise).toBe(1_500_000);
    // Independent check: the same balance straight from the ledger, as of the last instant of October in IST.
    const asOf = await agent.get('/api/transactions/summary?to=2026-10-31T18:29:59.999Z');
    expect(asOf.body.data.balancePaise).toBe(s.closingPaise);
    // The borrowed money is not income.
    expect(s.incomePaise).toBe(1_000_000);
  });

  it('puts the 1 Nov 01:30 IST expense in November and the category totals add up to the expenses', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A');
    const nov = (await agent.get('/api/reports/summary?month=2026-11')).body.data;
    expect(nov.summary.expensesPaise).toBe(10_000);
    expect(nov.summary.openingPaise).toBe(200_000 + 1_000_000 - 25_050 - 120_000 - 30_000 + 20_000);
    const oct = (await agent.get(`/api/reports/summary?${OCT}`)).body.data;
    expect(oct.categories.reduce((n: number, c: { totalPaise: number }) => n + c.totalPaise, 0)).toBe(oct.summary.expensesPaise);
    expect(oct.categories.map((c: { category: string }) => c.category)).toContain('Fee payments');
  });

  it('supports yearly and custom ranges, and a custom "to" date includes the whole last day', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A');
    const year = (await agent.get('/api/reports/summary?year=2026')).body.data;
    expect(year.summary.incomePaise).toBe(1_200_000);
    expect(year.meta.period).toBe('year');
    const day = (await agent.get('/api/reports/summary?from=2026-10-10&to=2026-10-10')).body.data;
    expect(day.meta.period).toBe('custom');
    expect(day.summary.expensesPaise).toBe(25_050);
  });

  it('scopes narrow what is reported', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A');
    const inc = (await agent.get(`/api/reports/summary?${OCT}&scope=income`)).body.data;
    expect(inc.categories).toEqual([]);
    expect(inc.incomeBySource).toHaveLength(1);
    const fees = (await agent.get(`/api/reports/summary?${OCT}&scope=fees`)).body.data;
    expect(fees.fees).toHaveLength(1);
    expect(fees.feePayments).toHaveLength(1);
    expect(fees.savings).toEqual([]);
  });

  it('shows an unpaid fee as upcoming, never as an expense', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A');
    const d = (await agent.get(`/api/reports/summary?${OCT}`)).body.data;
    expect(d.upcoming.fees).toHaveLength(1);
    expect(d.upcoming.fees[0]).toMatchObject({ totalPaise: 500_000, paidPaise: 120_000, remainingPaise: 380_000 });
    expect(d.summary.expensesPaise).toBeLessThan(500_000);
  });
});

describe('CSV export', () => {
  it('every section downloads as UTF-8 CSV with an attachment filename', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A');
    for (const section of CSV_SECTIONS) {
      const res = await getBin(agent, `/api/reports/csv?${OCT}&section=${section}`);
      expect(res.status, section).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="?CampusLedger_October-2026_\w+_\w+\.csv"?/);
      expect(res.headers['cache-control']).toBe('no-store');
      expect((res.body as Buffer).toString('utf8').startsWith('\uFEFF')).toBe(true);
    }
  });

  it('writes exact rupee amounts and the right rows', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A');
    const txt = (await getBin(agent, `/api/reports/csv?${OCT}&section=transactions`)).body.toString('utf8');
    const lines = txt.replace('\uFEFF', '').trim().split('\r\n');
    expect(lines[0]).toBe('Date,Title,Category,Type,Money in,Money out');
    expect(txt).toContain('2026-10-10,A-lunch,Food,Expense,,250.50');
    expect(txt).toContain('A-tuition payment,Fees,Fee payment,,1200.00');
    expect(txt).toContain('Lent to A-Anu,Lending,Lent to friend,,300.00');
    expect(txt).toContain('Borrowed from A-Ben,Borrowing,Borrowed,200.00,');
    expect(txt).not.toContain('A-boundary');
    const summary = (await getBin(agent, `/api/reports/csv?${OCT}&section=summary`)).body.toString('utf8');
    expect(summary).toContain('Remaining balance,10449.50');
  });

  it('neutralises spreadsheet formulas in user-entered text', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A', { hostile: true });
    const txt = (await getBin(agent, `/api/reports/csv?${OCT}&section=expenses`)).body.toString('utf8');
    expect(txt).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
    expect(txt).not.toMatch(/,=HYPERLINK/);
    expect(txt).not.toMatch(/^=/m);
  });
});

describe('XLSX export', () => {
  it('has the seven worksheets from the spec, with numeric money and totals', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A');
    const res = await getBin(agent, `/api/reports/xlsx?${OCT}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    const wb = await loadWb(res.body);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Dashboard Summary', 'Income', 'Expenses', 'Fees and Payments', 'Borrowed Money', 'Lent Money', 'Budgets and Savings']);

    const expenses = wb.getWorksheet('Expenses')!;
    expect(expenses.getRow(2).getCell(2).value).toBe('A-lunch');
    const amount = expenses.getRow(2).getCell(4);
    expect(amount.value).toBe(250.5);
    expect(amount.numFmt).toContain('₹');
    const date = expenses.getRow(2).getCell(1).value as Date;
    expect(date.toISOString().slice(0, 10)).toBe('2026-10-10');
    expect(expenses.getRow(3).getCell(1).value).toBe('Total');
    expect((expenses.getRow(3).getCell(4).value as ExcelJS.CellFormulaValue).result).toBe(250.5);
    expect(expenses.autoFilter).toBeTruthy();

    const summary = wb.getWorksheet('Dashboard Summary')!;
    const labels: Record<string, unknown> = {};
    summary.eachRow((row) => { labels[String(row.getCell(1).value)] = row.getCell(2).value; });
    expect(labels['Remaining balance']).toBe(10449.5);
    expect(labels['Opening balance']).toBe(2000);
  });

  it('narrower scopes produce fewer sheets', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A');
    const names = async (scope: string) => {
      const wb = await loadWb((await getBin(agent, `/api/reports/xlsx?${OCT}&scope=${scope}`)).body);
      return wb.worksheets.map((w) => w.name);
    };
    expect(await names('expenses')).toEqual(['Dashboard Summary', 'Expenses']);
    expect(await names('income')).toEqual(['Dashboard Summary', 'Income']);
    expect(await names('fees')).toEqual(['Dashboard Summary', 'Fees and Payments']);
  });
});

describe('PDF export', () => {
  async function pdfText(buf: Buffer): Promise<{ text: string; pages: number }> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
    }
    return { text, pages: doc.numPages };
  }

  it('is a real PDF with the user, period, balances and the ₹ sign', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A');
    const res = await getBin(agent, `/api/reports/pdf?${OCT}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const buf = res.body as Buffer;
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.subarray(-8).toString()).toContain('%%EOF');
    const { text, pages } = await pdfText(buf);
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(text).toContain('Monthly report');
    expect(text).toContain('October 2026');
    expect(text).toContain('Test a');
    expect(text).toContain('₹10,449.50'); // remaining balance
    expect(text).toContain('A-lunch');
    expect(text).toContain('Upcoming payments');
    expect(text).toContain('A-Laptop');
    expect(text).toMatch(/Page 1 of \d+/);
  });

  it('paginates long histories without losing rows', async () => {
    const { agent } = await signup('a');
    await agent.post('/api/income').send({ source: 'parents', amount: 100000, date: '2026-10-01T10:00:00Z' });
    for (let i = 0; i < 70; i++) await agent.post('/api/expenses').send({ title: `Row-${i}`, amount: 10, category: 'Food', date: '2026-10-02T10:00:00Z' });
    const { text, pages } = await pdfText((await getBin(agent, `/api/reports/pdf?${OCT}`)).body as Buffer);
    expect(pages).toBeGreaterThanOrEqual(3);
    expect(text).toContain('Row-0');
    expect(text).toContain('Row-69');
  });

  it('other scopes get their own title', async () => {
    const { agent } = await signup('a');
    await seed(agent, 'A');
    const titles: Record<string, string> = { expenses: 'Expense report', income: 'Income report', fees: 'Fee report' };
    for (const [scope, title] of Object.entries(titles)) {
      const { text } = await pdfText((await getBin(agent, `/api/reports/pdf?${OCT}&scope=${scope}`)).body as Buffer);
      expect(text, scope).toContain(title);
    }
    const yearly = await pdfText((await getBin(agent, '/api/reports/pdf?year=2026')).body as Buffer);
    expect(yearly.text).toContain('Yearly report');
  });
});

describe('user isolation in every export', () => {
  it('a second user only ever sees their own data, in JSON, CSV, XLSX and PDF', async () => {
    const a = await signup('a');
    const b = await signup('b');
    await seed(a.agent, 'ALPHA');
    await seed(b.agent, 'BRAVO');

    const collect = async (agent: Agent) => {
      const parts: string[] = [JSON.stringify((await agent.get(`/api/reports/summary?${OCT}`)).body)];
      for (const section of CSV_SECTIONS) parts.push((await getBin(agent, `/api/reports/csv?${OCT}&section=${section}`)).body.toString('utf8'));
      const wb = await loadWb((await getBin(agent, `/api/reports/xlsx?${OCT}`)).body);
      wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => parts.push(JSON.stringify(c.value)))));
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const pdf = await pdfjs.getDocument({ data: new Uint8Array((await getBin(agent, `/api/reports/pdf?${OCT}`)).body as Buffer), useSystemFonts: true }).promise;
      for (let i = 1; i <= pdf.numPages; i++) parts.push((await (await pdf.getPage(i)).getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join(' '));
      return parts.join('\n');
    };

    const forA = await collect(a.agent);
    const forB = await collect(b.agent);
    expect(forA).toContain('ALPHA-lunch');
    expect(forA).toContain('ALPHA-Laptop');
    expect(forA).not.toContain('BRAVO');
    expect(forB).toContain('BRAVO-lunch');
    expect(forB).toContain('BRAVO-Laptop');
    expect(forB).not.toContain('ALPHA');
  });

  it('a user with no data gets valid, empty reports in every format', async () => {
    const { agent } = await signup('empty');
    expect((await agent.get(`/api/reports/summary?${OCT}`)).body.data.summary.closingPaise).toBe(0);
    for (const fmt of ['pdf', 'xlsx']) {
      const res = await getBin(agent, `/api/reports/${fmt}?${OCT}`);
      expect(res.status, fmt).toBe(200);
      expect((res.body as Buffer).length, fmt).toBeGreaterThan(1000);
    }
    const csv = await getBin(agent, `/api/reports/csv?${OCT}`);
    expect(csv.status).toBe(200);
    expect(csv.body.toString('utf8')).toBe('\uFEFFDate,Title,Category,Type,Money in,Money out\r\n');
    const wb = await loadWb((await getBin(agent, `/api/reports/xlsx?${OCT}`)).body);
    expect(wb.getWorksheet('Expenses')!.getRow(2).getCell(1).value).toBe('No records');
  });
});

describe('access, validation and notifications', () => {
  it('every report route needs a login', async () => {
    for (const p of ['summary', 'pdf', 'xlsx', 'csv']) expect((await anonymous().get(`/api/reports/${p}?${OCT}`)).status, p).toBe(401);
  });

  it('rejects bad ranges, scopes and sections', async () => {
    const { agent } = await signup('a');
    const bad = [
      '/api/reports/summary?month=2026-13',
      '/api/reports/summary?month=October',
      '/api/reports/summary?from=2026-10-01',
      '/api/reports/summary?to=2026-10-01',
      '/api/reports/summary?from=2026-10-10&to=2026-10-01',
      '/api/reports/summary?from=2000-01-01&to=2026-10-01',
      '/api/reports/summary?scope=everything',
      '/api/reports/summary?year=1850',
      '/api/reports/csv?section=passwords',
    ];
    for (const url of bad) expect((await agent.get(url)).status, url).toBe(400);
  });

  it('records a notification for each successful export, for that user only', async () => {
    const a = await signup('a');
    const b = await signup('b');
    await getBin(a.agent, `/api/reports/pdf?${OCT}`);
    await getBin(a.agent, `/api/reports/csv?${OCT}`);
    expect(await Notification.countDocuments({ userId: a.id, type: 'export_ready' })).toBe(2);
    expect(await Notification.countDocuments({ userId: b.id, type: 'export_ready' })).toBe(0);
    const list = (await a.agent.get('/api/notifications')).body.data.items;
    expect(list.filter((n: { type: string }) => n.type === 'export_ready')).toHaveLength(2);
  });

  it('never caches exports', async () => {
    const { agent } = await signup('a');
    for (const fmt of ['pdf', 'xlsx', 'csv']) expect((await getBin(agent, `/api/reports/${fmt}?${OCT}`)).headers['cache-control']).toBe('no-store');
  });
});
