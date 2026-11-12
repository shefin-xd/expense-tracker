import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { LedgerEntry } from '../src/models/LedgerEntry';
import { User } from '../src/models/User';
import { balance, clearDb, iso, signup, startDb, stopDb, type Agent } from './helpers';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const income = (a: Agent, amount: number | string, source = 'parents', date = iso(-1)) => a.post('/api/income').send({ source, amount, date });
const expense = (a: Agent, amount: number | string, category = 'Food', extra = {}) => a.post('/api/expenses').send({ title: 'Lunch', amount, category, date: iso(-1), ...extra });

describe('income and expenses keep the balance correct', () => {
  it('income up, expense down, edits and deletes stay consistent', async () => {
    const { agent } = await signup();
    expect((await income(agent, 10000)).status).toBe(201);
    expect(await balance(agent)).toBe(1_000_000);

    const e = await expense(agent, '250.50');
    expect(e.status).toBe(201);
    expect(e.body.data.amountPaise).toBe(25050);
    expect(await balance(agent)).toBe(1_000_000 - 25050);

    await agent.patch(`/api/expenses/${e.body.data.id}`).send({ amount: 100 });
    expect(await balance(agent)).toBe(1_000_000 - 10000);

    await agent.delete(`/api/expenses/${e.body.data.id}`);
    expect(await balance(agent)).toBe(1_000_000);
    expect((await agent.get(`/api/expenses/${e.body.data.id}`)).status).toBe(404);
  });

  it('sums many tiny amounts exactly', async () => {
    const { agent } = await signup();
    for (let i = 0; i < 10; i++) await income(agent, '0.10');
    expect(await balance(agent)).toBe(100);
  });

  it('validates amounts, categories and dates', async () => {
    const { agent } = await signup();
    for (const bad of [0, -5, '1.234', 'abc', 'Infinity']) expect((await expense(agent, bad as number)).status).toBe(400);
    expect((await expense(agent, 10, 'NotACategory')).status).toBe(400);
    expect((await agent.post('/api/expenses').send({ title: 'x', amount: 5, category: 'Food', date: 'nope' })).status).toBe(400);
    expect(await balance(agent)).toBe(0);
  });

  it('lists with search, category filter, sort and pagination', async () => {
    const { agent } = await signup();
    await expense(agent, 50, 'Food', { title: 'Biriyani' });
    await expense(agent, 20, 'Snacks', { title: 'Chips' });
    await expense(agent, 300, 'Food', { title: 'Mess bill' });
    const search = await agent.get('/api/expenses?search=biri');
    expect(search.body.data).toHaveLength(1);
    expect((await agent.get('/api/expenses?category=Food')).body.meta.total).toBe(2);
    const sorted = await agent.get('/api/expenses?sortBy=amount&order=desc&limit=2');
    expect(sorted.body.data.map((x: { amountPaise: number }) => x.amountPaise)).toEqual([30000, 5000]);
    expect(sorted.body.meta).toMatchObject({ total: 3, totalPages: 2, limit: 2 });
    expect((await agent.get('/api/expenses?limit=1000')).status).toBe(400);
  });

  it('custom categories: create, use, rename cascades, delete blocked while in use', async () => {
    const { agent } = await signup();
    const cat = await agent.post('/api/categories').send({ name: 'Gym' });
    expect(cat.status).toBe(201);
    expect((await agent.post('/api/categories').send({ name: 'gym' })).status).toBe(409);
    expect((await agent.post('/api/categories').send({ name: 'Food' })).status).toBe(409);
    await expense(agent, 100, 'Gym');
    await agent.patch(`/api/categories/${cat.body.data.id}`).send({ name: 'Fitness' });
    expect((await agent.get('/api/expenses?category=Fitness')).body.meta.total).toBe(1);
    expect((await agent.get('/api/transactions?category=Fitness')).body.meta.total).toBe(1);
    expect((await agent.delete(`/api/categories/${cat.body.data.id}`)).status).toBe(409);
  });

  it('parent allowance summary', async () => {
    const { agent } = await signup();
    await income(agent, 5000, 'parents', iso(-40));
    await income(agent, 3000, 'pocket_money', iso(-1));
    await income(agent, 999, 'scholarship', iso(-1));
    const s = (await agent.get('/api/income/parent-summary')).body.data;
    expect(s.totalPaise).toBe(800_000);
    expect(s.history).toHaveLength(2);
    expect(new Date(s.lastReceivedDate).getTime()).toBeGreaterThan(Date.now() - 3 * 86_400_000);
  });
});

describe('fees and partial payments', () => {
  const fee = (a: Agent, total = 5000, dueInDays = 30) =>
    a.post('/api/fees').send({ title: 'Semester fee', category: 'tuition', academicYear: '2026-27', total, dueDate: iso(dueInDays) });

  it('an unpaid fee never touches the balance; only actual payments do', async () => {
    const { agent } = await signup();
    await income(agent, 10000);
    const f = await fee(agent);
    expect(f.body.data).toMatchObject({ status: 'pending', paidPaise: 0, remainingPaise: 500_000 });
    expect(await balance(agent)).toBe(1_000_000);

    const p = await agent.post(`/api/fees/${f.body.data.id}/payments`).send({ amount: 1200, referenceNo: 'TXN1' });
    expect(p.status).toBe(201);
    expect(p.body.data.fee).toMatchObject({ status: 'partially_paid', paidPaise: 120_000, remainingPaise: 380_000 });
    expect(await balance(agent)).toBe(1_000_000 - 120_000);

    const done = await agent.post(`/api/fees/${f.body.data.id}/complete`).send({});
    expect(done.body.data.fee.status).toBe('paid');
    expect(await balance(agent)).toBe(1_000_000 - 500_000);
    expect((await agent.post(`/api/fees/${f.body.data.id}/complete`).send({})).status).toBe(400);
  });

  it('rejects overpayment and lowering the total below what is paid', async () => {
    const { agent } = await signup();
    const f = await fee(agent, 1000);
    await agent.post(`/api/fees/${f.body.data.id}/payments`).send({ amount: 700 });
    expect((await agent.post(`/api/fees/${f.body.data.id}/payments`).send({ amount: 400 })).status).toBe(400);
    expect((await agent.patch(`/api/fees/${f.body.data.id}`).send({ total: 500 })).status).toBe(400);
    expect((await agent.patch(`/api/fees/${f.body.data.id}`).send({ total: 800 })).status).toBe(200);
    expect(await balance(agent)).toBe(-70_000);
  });

  it('two simultaneous payments cannot overpay', async () => {
    const { agent } = await signup();
    const f = await fee(agent, 1000);
    const results = await Promise.all([600, 600].map((amount) => agent.post(`/api/fees/${f.body.data.id}/payments`).send({ amount })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect((await agent.get(`/api/fees/${f.body.data.id}`)).body.data.paidPaise).toBe(60_000);
    expect(await balance(agent)).toBe(-60_000);
  });

  it('deleting a payment restores the balance and the fee; deleting a fee removes its payments', async () => {
    const { agent } = await signup();
    const f = await fee(agent, 1000);
    const p = await agent.post(`/api/fees/${f.body.data.id}/payments`).send({ amount: 400 });
    const del = await agent.delete(`/api/fees/${f.body.data.id}/payments/${p.body.data.payment.id}`);
    expect(del.body.data).toMatchObject({ paidPaise: 0, status: 'pending' });
    expect(await balance(agent)).toBe(0);

    await agent.post(`/api/fees/${f.body.data.id}/payments`).send({ amount: 250 });
    expect(await balance(agent)).toBe(-25_000);
    await agent.delete(`/api/fees/${f.body.data.id}`);
    expect(await balance(agent)).toBe(0);
  });

  it('flags overdue fees and filters by status and academic year', async () => {
    const { agent } = await signup();
    await fee(agent, 1000, -3);
    await fee(agent, 2000, 20);
    expect((await agent.get('/api/fees?status=overdue')).body.data).toHaveLength(1);
    expect((await agent.get('/api/fees?academicYear=2026-27')).body.meta.total).toBe(2);
    expect((await agent.get('/api/fees?academicYear=1999-00')).body.meta.total).toBe(0);
  });
});

describe('lending and borrowing', () => {
  it('lent money leaves the balance and returns on repayment, never as income', async () => {
    const { agent } = await signup();
    await income(agent, 1000);
    const loan = await agent.post('/api/lending').send({ person: 'Arjun', amount: 500, date: iso(-2), expectedDate: iso(10) });
    expect(await balance(agent)).toBe(50_000);
    expect(loan.body.data).toMatchObject({ status: 'pending', remainingPaise: 50_000 });

    const r = await agent.post(`/api/lending/${loan.body.data.id}/repayments`).send({ amount: 200 });
    expect(r.body.data).toMatchObject({ status: 'partially_settled', remainingPaise: 30_000 });
    expect(await balance(agent)).toBe(70_000);
    const sum = (await agent.get('/api/transactions/summary')).body.data;
    expect(sum.totalIncomePaise).toBe(100_000);
    expect(sum.lentOutstandingPaise).toBe(30_000);

    expect((await agent.post(`/api/lending/${loan.body.data.id}/repayments`).send({ amount: 301 })).status).toBe(400);
    const done = await agent.post(`/api/lending/${loan.body.data.id}/repayments`).send({ amount: 300 });
    expect(done.body.data.status).toBe('settled');
  });

  it('borrowed money adds cash as a liability, not income; repaying is not an expense', async () => {
    const { agent } = await signup();
    const loan = await agent.post('/api/borrowing').send({ person: 'Nikhil', amount: 300, date: iso(-1) });
    expect(await balance(agent)).toBe(30_000);
    await agent.post(`/api/borrowing/${loan.body.data.id}/repayments`).send({ amount: 100 });
    const sum = (await agent.get('/api/transactions/summary')).body.data;
    expect(sum).toMatchObject({ balancePaise: 20_000, totalIncomePaise: 0, totalExpensesPaise: 0, borrowedOutstandingPaise: 20_000 });
    expect((await agent.get('/api/borrowing/summary')).body.data.outstandingPaise).toBe(20_000);
    // lending and borrowing are separate lists
    expect((await agent.get('/api/lending')).body.meta.total).toBe(0);
    expect((await agent.get(`/api/lending/${loan.body.data.id}`)).status).toBe(404);
  });

  it('removing a repayment or a whole loan reverses its ledger entries', async () => {
    const { agent } = await signup();
    const loan = await agent.post('/api/lending').send({ person: 'Dev', amount: 100, date: iso(-1) });
    const r = await agent.post(`/api/lending/${loan.body.data.id}/repayments`).send({ amount: 40 });
    const repId = r.body.data.repayments[0].id;
    await agent.delete(`/api/lending/${loan.body.data.id}/repayments/${repId}`);
    expect(await balance(agent)).toBe(-10_000);
    await agent.delete(`/api/lending/${loan.body.data.id}`);
    expect(await balance(agent)).toBe(0);
    expect(await LedgerEntry.countDocuments()).toBe(0);
  });

  it('marks loans overdue when the expected date passes', async () => {
    const { agent } = await signup();
    await agent.post('/api/lending').send({ person: 'Late', amount: 50, date: iso(-20), expectedDate: iso(-2) });
    expect((await agent.get('/api/lending?status=overdue')).body.data).toHaveLength(1);
  });
});

describe('budgets, savings, notifications, dashboard', () => {
  it('tracks budget use and warns at 80% and when exceeded, notifying once per level', async () => {
    const { agent } = await signup();
    await agent.put('/api/budgets/current').send({ overall: 1000, categories: [{ category: 'Food', limit: 500 }] });
    await expense(agent, 450, 'Food', { date: new Date().toISOString() });
    let b = (await agent.get('/api/budgets/current')).body.data;
    expect(b.categories[0]).toMatchObject({ spentPaise: 45_000, remainingPaise: 5_000, level: 'warning', percentUsed: 90 });
    expect(b.overall.level).toBe('ok');

    const first = (await agent.get('/api/notifications')).body.data;
    expect(first.items.filter((n: { type: string }) => n.type === 'budget_warning')).toHaveLength(1);
    expect((await agent.get('/api/notifications')).body.data.items).toHaveLength(first.items.length); // no duplicates

    await expense(agent, 100, 'Food', { date: new Date().toISOString() });
    b = (await agent.get('/api/budgets/current')).body.data;
    expect(b.categories[0].level).toBe('over');
    const second = (await agent.get('/api/notifications')).body.data;
    expect(second.items.length).toBe(first.items.length + 1);
    expect(second.unreadCount).toBe(second.items.length);

    await agent.post('/api/notifications/read-all');
    expect((await agent.get('/api/notifications?unread=true')).body.data.items).toHaveLength(0);
    expect((await agent.put('/api/budgets/current').send({ categories: [] })).status).toBe(400);
  });

  it('notifies about overdue fees unless the user turned that off', async () => {
    const { agent } = await signup();
    await agent.post('/api/fees').send({ title: 'Hostel fee', category: 'hostel', academicYear: '2026-27', total: 100, dueDate: iso(-1) });
    expect((await agent.get('/api/notifications')).body.data.items.some((n: { type: string }) => n.type === 'fee_overdue')).toBe(true);

    const { agent: other } = await signup();
    await other.patch('/api/users/me').send({ preferences: { notifications: { feeDeadlines: false } } });
    await other.post('/api/fees').send({ title: 'Hostel fee', category: 'hostel', academicYear: '2026-27', total: 100, dueDate: iso(-1) });
    expect((await other.get('/api/notifications')).body.data.items).toHaveLength(0);
  });

  it('savings goals show progress and do not move the balance', async () => {
    const { agent } = await signup();
    const g = await agent.post('/api/savings').send({ name: 'Laptop', target: 60000, saved: 15000 });
    expect(g.body.data).toMatchObject({ percentSaved: 25, remainingPaise: 4_500_000 });
    await agent.patch(`/api/savings/${g.body.data.id}`).send({ saved: 60000 });
    const list = (await agent.get('/api/savings')).body.data;
    expect(list.goals[0].reached).toBe(true);
    expect(list.totalSavedPaise).toBe(6_000_000);
    expect(await balance(agent)).toBe(0);
  });

  it('dashboard numbers come from the ledger', async () => {
    const { agent } = await signup();
    await income(agent, 2000);
    await expense(agent, 300, 'Food', { date: new Date().toISOString() });
    await agent.post('/api/fees').send({ title: 'Lab fee', category: 'lab', academicYear: '2026-27', total: 800, dueDate: iso(5) });
    const d = (await agent.get('/api/dashboard')).body.data;
    expect(d.balance.currentPaise).toBe(170_000);
    expect(d.allTime).toEqual({ totalIncomePaise: 200_000, totalExpensesPaise: 30_000 });
    expect(d.categoryBreakdown[0]).toMatchObject({ category: 'Food', totalPaise: 30_000 });
    expect(d.upcoming.fees).toHaveLength(1);
    expect(d.recentTransactions.length).toBe(2);
  });

  it('category breakdown includes fee payments so it matches the spending chart', async () => {
    const { agent } = await signup();
    await expense(agent, 300, 'Food', { date: new Date().toISOString() });
    const fee = await agent.post('/api/fees').send({ title: 'Lab fee', category: 'lab', academicYear: '2026-27', total: 800, dueDate: iso(5) });
    await agent.post(`/api/fees/${fee.body.data.id}/payments`).send({ amount: 500, date: new Date().toISOString() });
    const d = (await agent.get('/api/dashboard')).body.data;
    expect(d.categoryBreakdown).toEqual([
      { category: 'Fees', totalPaise: 50_000, count: 1 },
      { category: 'Food', totalPaise: 30_000, count: 1 },
    ]);
    const chartTotal = d.spendingSeries.reduce((s: number, p: { totalPaise: number }) => s + p.totalPaise, 0);
    expect(d.categoryBreakdown.reduce((s: number, c: { totalPaise: number }) => s + c.totalPaise, 0)).toBe(chartTotal);
  });

  it('transactions page filters by type and searches titles', async () => {
    const { agent } = await signup();
    await income(agent, 100);
    await expense(agent, 10, 'Food', { title: 'Tea' });
    expect((await agent.get('/api/transactions?type=income')).body.meta.total).toBe(1);
    expect((await agent.get('/api/transactions?type=expense&search=tea')).body.data).toHaveLength(1);
  });
});

describe('account data', () => {
  it('exports everything the user owns and deletes it all on account deletion', async () => {
    const { agent, id } = await signup();
    await income(agent, 100);
    await expense(agent, 10);
    const exp = (await agent.get('/api/users/me/export')).body.data;
    expect(exp.expenses).toHaveLength(1);
    expect(exp.ledger).toHaveLength(2);
    expect(JSON.stringify(exp)).not.toMatch(/passwordHash/);

    expect((await agent.delete('/api/users/me').send({ password: 'wrong-pass1' })).status).toBe(401);
    expect((await agent.delete('/api/users/me').send({ password: 'Passw0rd!x' })).status).toBe(200);
    expect(await User.findById(id)).toBeNull();
    expect(await LedgerEntry.countDocuments()).toBe(0);
    for (const c of Object.values(mongoose.connection.collections)) expect(await c.countDocuments()).toBe(0);
  });
});
