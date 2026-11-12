import ExcelJS from 'exceljs';
import rawPdfParse from 'pdf-parse/lib/pdf-parse.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { anonymous, balance, clearDb, iso, signup, startDb, stopDb, type Agent } from './helpers';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

// pdf-parse 1.1.1 (an old pdf.js build) rejects the very first file it opens in a process with
// "bad XRef entry"; the same bytes parse fine on retry (and pass qpdf/pypdf checks).
const pdfParse = async (buf: Buffer) => {
  try { return await rawPdfParse(buf); } catch { return rawPdfParse(buf); }
};

const SHEETS = ['Dashboard Summary', 'Income', 'Expenses', 'Fees and Payments', 'Borrowed Money', 'Lent Money', 'Budgets and Savings'];

async function download(agent: Agent | ReturnType<typeof anonymous>, url: string) {
  const res = await agent.get(url).buffer(true).parse((r, cb) => {
    const chunks: Buffer[] = [];
    r.on('data', (c: Buffer) => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  return { status: res.status, headers: res.headers, body: res.body as Buffer };
}
const xlsxOf = async (buf: Buffer) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as unknown as ArrayBuffer); return wb; };
const allText = (wb: ExcelJS.Workbook) => { const out: string[] = []; wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => out.push(String(typeof c.value === 'object' && c.value && 'result' in c.value ? c.value.result : c.value))))); return out.join('\n'); };
const nowIso = () => new Date().toISOString();

/** Alice: prior-month income, then this month's income, expense, fee payment, loan, budget, savings. */
async function seedAlice(agent: Agent) {
  await agent.post('/api/income').send({ source: 'parents', amount: 10000, date: iso(-45), description: 'Old allowance' });
  await agent.post('/api/income').send({ source: 'pocket_money', amount: 2000, date: nowIso() });
  await agent.post('/api/expenses').send({ title: 'Biriyani Zeta', amount: '250.50', category: 'Food', date: nowIso(), paymentMethod: 'upi' });
  const fee = await agent.post('/api/fees').send({ title: 'Semester fee', category: 'tuition', academicYear: '2026-27', total: 5000, dueDate: iso(20) });
  await agent.post(`/api/fees/${fee.body.data.id}/payments`).send({ amount: 1200, referenceNo: 'REF-ALICE-1' });
  await agent.post('/api/lending').send({ person: 'Arjun Lent', amount: 500, date: nowIso(), expectedDate: iso(10) });
  await agent.post('/api/borrowing').send({ person: 'Nikhil Owed', amount: 300, date: nowIso() });
  await agent.put('/api/budgets/current').send({ overall: 5000, categories: [{ category: 'Food', limit: 1000 }] });
  await agent.post('/api/savings').send({ name: 'Laptop Fund', target: 60000, saved: 15000 });
}
const ALICE_SECRETS = ['Biriyani Zeta', 'Semester fee', 'REF-ALICE-1', 'Arjun Lent', 'Nikhil Owed', 'Laptop Fund', 'Old allowance', 'Test alice'];

describe('XLSX export', () => {
  it('has the seven worksheets, correct totals, INR/date formats and filters', async () => {
    const { agent } = await signup('alice');
    await seedAlice(agent);
    const res = await download(agent, '/api/reports/xlsx?type=monthly&month=' + new Date().toISOString().slice(0, 7));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="campusledger-monthly-.*\.xlsx"/);
    const wb = await xlsxOf(res.body);
    expect(wb.worksheets.map((w) => w.name)).toEqual(SHEETS);

    // Summary numbers: opening 10,000; income 2,000; expenses 250.50 + 1,200 fee payment.
    const summary = wb.getWorksheet('Dashboard Summary')!;
    const val = (label: string) => { let v: unknown; summary.eachRow((r) => { if (r.getCell(1).value === label) v = r.getCell(2).value; }); return v; };
    expect(val('Opening balance')).toBe(10000);
    expect(val('Total income')).toBe(2000);
    expect(val('Total expenses')).toBe(1450.5);
    expect(val('Remaining balance')).toBe(10349.5);
    expect(val('Friends owe you')).toBe(500);
    expect(val('You owe friends')).toBe(300);
    expect(val('Remaining balance')).toBe((await balance(agent)) / 100);

    const exp = wb.getWorksheet('Expenses')!;
    expect(exp.getRow(2).getCell(2).value).toBe('Biriyani Zeta');
    expect(exp.getRow(2).getCell(7).value).toBe(250.5);
    expect(exp.getRow(2).getCell(7).numFmt).toContain('₹');
    expect(exp.getRow(2).getCell(1).numFmt).toBe('dd/mm/yyyy');
    expect(exp.autoFilter).toBeTruthy();
    expect(exp.getRow(3).getCell(7).value).toMatchObject({ formula: 'SUM(G2:G2)', result: 250.5 });

    const fees = allText(wb.getWorksheet('Fees and Payments')!.workbook);
    expect(fees).toContain('Semester fee');
    expect(fees).toContain('REF-ALICE-1');
    expect(allText(wb)).toContain('Laptop Fund');
  });

  it('never executes user text as a formula', async () => {
    const { agent } = await signup('alice');
    await agent.post('/api/expenses').send({ title: '=HYPERLINK("http://evil","x")', amount: 5, category: 'Food', date: nowIso() });
    const wb = await xlsxOf((await download(agent, '/api/reports/xlsx')).body);
    const cell = wb.getWorksheet('Expenses')!.getRow(2).getCell(2);
    expect(typeof cell.value).toBe('string');
    expect(String(cell.value).startsWith("'=")).toBe(true);
  });
});

describe('CSV export', () => {
  it('exports transactions with a BOM, escaping and signed columns', async () => {
    const { agent } = await signup('alice');
    await agent.post('/api/income').send({ source: 'parents', amount: 100, date: nowIso() });
    await agent.post('/api/expenses').send({ title: 'Tea, "special"', amount: 12.5, category: 'Snacks', date: nowIso() });
    await agent.post('/api/expenses').send({ title: '=cmd|calc', amount: 1, category: 'Food', date: nowIso() });
    const res = await download(agent, '/api/reports/csv');
    expect(res.headers['content-type']).toContain('text/csv');
    const text = res.body.toString('utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Date,Type,Title,Category,Money In (INR),Money Out (INR)');
    expect(text).toContain('"Tea, ""special"""');
    expect(text).toContain("'=cmd|calc");
    expect(text).toMatch(/Money from parents,.*,100\.00,/);
    expect(text).toMatch(/,12\.50\r\n/);
  });

  it('supports the other datasets and report-type defaults', async () => {
    const { agent } = await signup('alice');
    await seedAlice(agent);
    const loans = (await download(agent, '/api/reports/csv?dataset=loans')).body.toString();
    expect(loans).toContain('Lent,Arjun Lent');
    expect(loans).toContain('Borrowed,Nikhil Owed');
    expect((await download(agent, '/api/reports/csv?type=fees')).body.toString()).toContain('Semester fee,tuition,2026-27');
    expect((await download(agent, '/api/reports/csv?type=fees&academicYear=1999-00')).body.toString()).not.toContain('Semester fee');
    expect((await download(agent, '/api/reports/csv?type=income&dataset=income')).body.toString()).toContain('Monthly pocket money');
  });

  it('treats custom from/to as whole IST days', async () => {
    const { agent } = await signup('alice');
    // 20:00 UTC on 5 Nov is 01:30 IST on 6 Nov.
    await agent.post('/api/expenses').send({ title: 'Late night chai', amount: 10, category: 'Food', date: '2026-11-05T20:00:00.000Z' });
    const hit = await download(agent, '/api/reports/csv?type=custom&dataset=expenses&from=2026-11-06&to=2026-11-06');
    expect(hit.body.toString()).toContain('06/11/2026,Late night chai');
    const miss = await download(agent, '/api/reports/csv?type=custom&dataset=expenses&from=2026-11-05&to=2026-11-05');
    expect(miss.body.toString()).not.toContain('Late night chai');
  });
});

describe('PDF export', () => {
  it('produces a valid PDF with the required sections and figures', async () => {
    const { agent } = await signup('alice');
    await seedAlice(agent);
    const res = await download(agent, '/api/reports/pdf?type=monthly');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    const { text } = await pdfParse(res.body);
    for (const needle of ['Monthly Financial Report', 'Test alice', 'Opening balance', 'Rs. 10,000.00', 'Total income', 'Total expenses', 'Remaining balance', 'Rs. 10,349.50',
      'Category-wise spending', 'Transaction history', 'Upcoming payments', 'Savings summary', 'Biriyani Zeta', 'Semester fee', 'Laptop Fund'])
      expect(text, needle).toContain(needle);
  });

  it('paginates long histories and numbers the pages', async () => {
    const { agent } = await signup('alice');
    for (let i = 0; i < 120; i++) await agent.post('/api/expenses').send({ title: `Item ${i}`, amount: 1, category: 'Food', date: nowIso() });
    const { numpages, text } = await pdfParse((await download(agent, '/api/reports/pdf')).body);
    expect(numpages).toBeGreaterThanOrEqual(3);
    expect(text).toContain(`Page ${numpages} of ${numpages}`);
    expect(text).toContain('Item 119');
  });

  it('renders the expense-only, income-only and fee reports', async () => {
    const { agent } = await signup('alice');
    await seedAlice(agent);
    const exp = (await pdfParse((await download(agent, '/api/reports/pdf?type=expenses')).body)).text;
    expect(exp).toContain('Expense Report');
    expect(exp).toContain('Expense records');
    expect(exp).not.toContain('Savings summary');
    const inc = (await pdfParse((await download(agent, '/api/reports/pdf?type=income')).body)).text;
    expect(inc).toContain('Income by source');
    const fee = (await pdfParse((await download(agent, '/api/reports/pdf?type=fees')).body)).text;
    expect(fee).toContain('Fees & Payments Report');
    expect(fee).toContain('REF-ALICE-1');
  });

  it('yearly reports cover the whole IST year', async () => {
    const { agent } = await signup('alice');
    await agent.post('/api/income').send({ source: 'scholarship', amount: 777, date: nowIso() });
    const year = new Date().getUTCFullYear();
    const { text } = await pdfParse((await download(agent, `/api/reports/pdf?type=yearly&year=${year}`)).body);
    expect(text).toContain('Yearly Financial Report');
    expect(text).toContain('Rs. 777.00');
  });
});

describe('export safety', () => {
  it('another account never receives my data in any format, and gets its own zeros', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    await seedAlice(alice.agent);

    const csv = (await download(bob.agent, '/api/reports/csv')).body.toString();
    const loans = (await download(bob.agent, '/api/reports/csv?dataset=loans')).body.toString();
    const wb = await xlsxOf((await download(bob.agent, '/api/reports/xlsx')).body);
    const pdf = (await pdfParse((await download(bob.agent, '/api/reports/pdf')).body)).text;
    const pdfFees = (await pdfParse((await download(bob.agent, '/api/reports/pdf?type=fees')).body)).text;
    for (const secret of ALICE_SECRETS.filter((s) => s !== 'Test alice')) {
      for (const [name, blob] of Object.entries({ csv, loans, xlsx: allText(wb), pdf, pdfFees })) expect(blob, `${name} leaks "${secret}"`).not.toContain(secret);
    }
    expect(pdf).toContain('Test bob');
    const summary = wb.getWorksheet('Dashboard Summary')!;
    summary.eachRow((r) => { if (['Opening balance', 'Total income', 'Total expenses', 'Remaining balance'].includes(String(r.getCell(1).value))) expect(r.getCell(2).value).toBe(0); });
  });

  it('requires login and validates parameters', async () => {
    expect((await download(anonymous(), '/api/reports/pdf')).status).toBe(401);
    const { agent } = await signup('alice');
    for (const bad of ['?month=2026-13', '?type=custom', '?type=custom&from=2026-02-01', '?type=custom&from=2026-03-01&to=2026-02-01', '?type=custom&from=2000-01-01&to=2026-01-01', '?type=bogus', '?from=06-11-2026&to=07-11-2026&type=custom', '?year=1800'])
      expect((await agent.get('/api/reports/pdf' + bad)).status, bad).toBe(400);
  });

  it('notifies when an export is generated', async () => {
    const { agent } = await signup('alice');
    await download(agent, '/api/reports/csv');
    await download(agent, '/api/reports/csv');
    const items = (await agent.get('/api/notifications')).body.data.items as { type: string }[];
    expect(items.filter((n) => n.type === 'export_ready')).toHaveLength(2);
  });
});
