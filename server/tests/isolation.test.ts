import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonymous, balance, clearDb, iso, signup, startDb, stopDb } from './helpers';

beforeAll(startDb);
afterAll(stopDb);

describe('user data isolation', () => {
  it('another account can never read, change or delete my records', async () => {
    await clearDb();
    const a = await signup('alice');
    const b = await signup('bob');

    // Alice builds a full set of private data.
    const exp = (await a.agent.post('/api/expenses').send({ title: 'Secret', amount: 100, category: 'Food', date: iso(-1) })).body.data.id;
    const inc = (await a.agent.post('/api/income').send({ source: 'parents', amount: 5000, date: iso(-1) })).body.data.id;
    const fee = (await a.agent.post('/api/fees').send({ title: 'Fee', category: 'tuition', academicYear: '2026-27', total: 1000, dueDate: iso(5) })).body.data.id;
    const pay = (await a.agent.post(`/api/fees/${fee}/payments`).send({ amount: 100 })).body.data.payment.id;
    const lent = (await a.agent.post('/api/lending').send({ person: 'P', amount: 100, date: iso(-1) })).body.data.id;
    const rep = (await a.agent.post(`/api/lending/${lent}/repayments`).send({ amount: 10 })).body.data.repayments[0].id;
    const borrowed = (await a.agent.post('/api/borrowing').send({ person: 'Q', amount: 100, date: iso(-1) })).body.data.id;
    const goal = (await a.agent.post('/api/savings').send({ name: 'G', target: 100 })).body.data.id;
    const cat = (await a.agent.post('/api/categories').send({ name: 'Mine' })).body.data.id;
    await a.agent.put('/api/budgets/current').send({ overall: 1000 });
    await a.agent.post('/api/fees').send({ title: 'Old', category: 'lab', academicYear: '2026-27', total: 10, dueDate: iso(-2) });
    const note = (await a.agent.get('/api/notifications')).body.data.items[0].id;
    const aliceBalance = await balance(a.agent);

    // Bob tries every route against Alice's ids: always 404 (never 200, never 403 that leaks existence).
    const attempts: [string, string, object?][] = [
      ['get', `/api/expenses/${exp}`], ['patch', `/api/expenses/${exp}`, { amount: 1 }], ['delete', `/api/expenses/${exp}`],
      ['get', `/api/income/${inc}`], ['patch', `/api/income/${inc}`, { amount: 1 }], ['delete', `/api/income/${inc}`],
      ['get', `/api/fees/${fee}`], ['patch', `/api/fees/${fee}`, { total: 5000 }], ['delete', `/api/fees/${fee}`],
      ['post', `/api/fees/${fee}/payments`, { amount: 1 }], ['post', `/api/fees/${fee}/complete`, {}], ['delete', `/api/fees/${fee}/payments/${pay}`],
      ['get', `/api/lending/${lent}`], ['patch', `/api/lending/${lent}`, { amount: 5000 }], ['delete', `/api/lending/${lent}`],
      ['post', `/api/lending/${lent}/repayments`, { amount: 1 }], ['delete', `/api/lending/${lent}/repayments/${rep}`],
      ['get', `/api/borrowing/${borrowed}`], ['delete', `/api/borrowing/${borrowed}`], ['post', `/api/borrowing/${borrowed}/repayments`, { amount: 1 }],
      ['patch', `/api/savings/${goal}`, { saved: 100 }], ['delete', `/api/savings/${goal}`],
      ['patch', `/api/categories/${cat}`, { name: 'Hacked' }], ['delete', `/api/categories/${cat}`],
      ['post', `/api/notifications/${note}/read`], ['delete', `/api/notifications/${note}`],
    ];
    for (const [method, url, body] of attempts) {
      const req = (b.agent as unknown as Record<string, (u: string) => { send: (x?: object) => Promise<{ status: number }> }>)[method]!(url);
      const res = await (body ? req.send(body) : req.send());
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(404);
    }

    // Bob sees nothing of Alice's in any list, total or report.
    for (const url of ['/api/expenses', '/api/income', '/api/fees', '/api/lending', '/api/borrowing', '/api/transactions']) {
      const res = await b.agent.get(url);
      expect(res.body.data, url).toHaveLength(0);
    }
    expect((await b.agent.get('/api/savings')).body.data.goals).toHaveLength(0);
    expect((await b.agent.get('/api/categories')).body.data.custom).toHaveLength(0);
    expect((await b.agent.get('/api/income/parent-summary')).body.data.totalPaise).toBe(0);
    expect((await b.agent.get('/api/notifications')).body.data.items).toHaveLength(0);
    expect((await b.agent.get('/api/budgets/current')).body.data.hasBudget).toBe(false);
    expect(await balance(b.agent)).toBe(0);
    const dash = (await b.agent.get('/api/dashboard')).body.data;
    expect(dash.recentTransactions).toHaveLength(0);
    expect(JSON.stringify((await b.agent.get('/api/users/me/export')).body.data)).not.toMatch(/Secret|"Mine"/);

    // Bob cannot use Alice's custom category, and Alice's data is untouched.
    expect((await b.agent.post('/api/expenses').send({ title: 'x', amount: 1, category: 'Mine', date: iso() })).status).toBe(400);
    expect(await balance(a.agent)).toBe(aliceBalance);
    expect((await a.agent.get(`/api/expenses/${exp}`)).body.data.title).toBe('Secret');
    expect((await a.agent.get(`/api/fees/${fee}`)).body.data.paidPaise).toBe(10_000);
  });

  it('every data route requires a login', async () => {
    const id = '507f1f77bcf86cd799439011';
    const urls = ['/api/users/me/export', '/api/dashboard', '/api/categories', '/api/expenses', `/api/expenses/${id}`, '/api/income', '/api/income/parent-summary', '/api/transactions', '/api/transactions/summary', '/api/fees', `/api/fees/${id}`, '/api/lending', '/api/borrowing', '/api/budgets/current', '/api/savings', '/api/notifications'];
    for (const u of urls) expect((await anonymous().get(u)).status, u).toBe(401);
    expect((await anonymous().post('/api/expenses').send({})).status).toBe(401);
    expect((await anonymous().delete('/api/users/me').send({ password: 'x' })).status).toBe(401);
  });

  it('malformed ids are a plain 404', async () => {
    const { agent } = await signup();
    expect((await agent.get('/api/expenses/not-an-id')).status).toBe(404);
    expect((await agent.get('/api/fees/123')).status).toBe(404);
  });
});
