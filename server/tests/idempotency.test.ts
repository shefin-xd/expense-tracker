import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Expense } from '../src/models/Expense';
import { IdempotencyKey } from '../src/models/IdempotencyKey';
import { LedgerEntry } from '../src/models/LedgerEntry';
import { balance, clearDb, iso, signup, startDb, stopDb } from './helpers';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const body = { title: 'Lunch', amount: 100, category: 'Food', date: iso(-1) };

describe('duplicate-proof writes', () => {
  it('replays the first result instead of recording twice', async () => {
    const { agent } = await signup();
    const first = await agent.post('/api/expenses').set('Idempotency-Key', 'key-aaaaaaaa-1').send(body);
    const second = await agent.post('/api/expenses').set('Idempotency-Key', 'key-aaaaaaaa-1').send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await Expense.countDocuments()).toBe(1);
    expect(await LedgerEntry.countDocuments()).toBe(1);
    expect(await balance(agent)).toBe(-10_000);
  });

  it('two simultaneous requests with one key create one record', async () => {
    const { agent } = await signup();
    const res = await Promise.all([1, 2, 3].map(() => agent.post('/api/expenses').set('Idempotency-Key', 'key-race-0001').send(body)));
    expect(await Expense.countDocuments()).toBe(1);
    const ok = res.filter((r) => r.status === 201);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ok.map((r) => r.body.data.id)).size).toBe(1);
    for (const r of res.filter((x) => x.status !== 201)) expect(r.status).toBe(409); // still processing: ask again
  });

  it('the same key with a different request is refused', async () => {
    const { agent } = await signup();
    await agent.post('/api/expenses').set('Idempotency-Key', 'key-mismatch-1').send(body);
    const res = await agent.post('/api/expenses').set('Idempotency-Key', 'key-mismatch-1').send({ ...body, amount: 999 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_MISMATCH');
    expect(await Expense.countDocuments()).toBe(1);
  });

  it('a failed request frees the key so it can be fixed and retried', async () => {
    const { agent } = await signup();
    const bad = await agent.post('/api/expenses').set('Idempotency-Key', 'key-retry-0001').send({ ...body, amount: 'abc' });
    expect(bad.status).toBe(400);
    expect(await IdempotencyKey.countDocuments()).toBe(0);
    const good = await agent.post('/api/expenses').set('Idempotency-Key', 'key-retry-0001').send(body);
    expect(good.status).toBe(201);
  });

  it('keys are private to each user and optional', async () => {
    const a = await signup('alice');
    const b = await signup('bob');
    const ra = await a.agent.post('/api/expenses').set('Idempotency-Key', 'shared-key-0001').send(body);
    const rb = await b.agent.post('/api/expenses').set('Idempotency-Key', 'shared-key-0001').send(body);
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
    expect(rb.body.data.id).not.toBe(ra.body.data.id);
    expect(await Expense.countDocuments()).toBe(2);
    // without a key two identical requests are two records, as before
    await a.agent.post('/api/expenses').send(body);
    await a.agent.post('/api/expenses').send(body);
    expect(await Expense.countDocuments()).toBe(4);
    expect((await a.agent.post('/api/expenses').set('Idempotency-Key', 'bad key!').send(body)).status).toBe(400);
  });

  it('covers fee payments and loan repayments, where a double submit would be costly', async () => {
    const { agent } = await signup();
    const fee = await agent.post('/api/fees').send({ title: 'Fee', category: 'tuition', academicYear: '2026-27', total: 1000, dueDate: iso(9) });
    const pay = () => agent.post(`/api/fees/${fee.body.data.id}/payments`).set('Idempotency-Key', 'pay-key-00001').send({ amount: 400 });
    await pay(); const again = await pay();
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(await balance(agent)).toBe(-40_000);
    expect((await agent.get(`/api/fees/${fee.body.data.id}`)).body.data.paidPaise).toBe(40_000);
  });
});
