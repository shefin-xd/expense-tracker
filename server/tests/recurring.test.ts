import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nextMonth, recurringState } from '../src/services/recurring.rules';
import { currentMonthIST } from '../src/utils/dates';
import { balance, clearDb, signup, startDb, stopDb } from './helpers';

describe('recurring rules (pure)', () => {
  const base = { active: true, startMonth: '2026-01', lastHandledMonth: null, dayOfMonth: 5 };
  const at = (iso: string) => new Date(iso);
  it('is due from its day of the month until handled', () => {
    expect(recurringState(base, at('2026-11-04T10:00:00+05:30')).due).toBe(false);
    expect(recurringState(base, at('2026-11-05T00:00:00+05:30')).due).toBe(true);
    expect(recurringState(base, at('2026-11-28T10:00:00+05:30')).due).toBe(true);
    expect(recurringState({ ...base, lastHandledMonth: '2026-11' }, at('2026-11-28T10:00:00+05:30')).due).toBe(false);
    expect(recurringState({ ...base, lastHandledMonth: '2026-10' }, at('2026-11-05T10:00:00+05:30')).due).toBe(true); // last month's handling does not count
  });
  it('uses Indian time for the month boundary', () => {
    // 20:00 UTC on 31 Oct is already 1 Nov 01:30 in India
    expect(recurringState({ ...base, dayOfMonth: 1 }, at('2026-10-31T20:00:00Z')).month).toBe('2026-11');
    expect(recurringState({ ...base, dayOfMonth: 1 }, at('2026-10-31T20:00:00Z')).due).toBe(true);
  });
  it('is not due when paused or before its start month, and reports the next date', () => {
    expect(recurringState({ ...base, active: false }, at('2026-11-20T10:00:00+05:30')).due).toBe(false);
    expect(recurringState({ ...base, startMonth: '2027-01' }, at('2026-11-20T10:00:00+05:30'))).toMatchObject({ due: false, nextDueDate: '2027-01-05' });
    expect(recurringState({ ...base, lastHandledMonth: '2026-12' }, at('2026-12-20T10:00:00+05:30')).nextDueDate).toBe('2027-01-05');
    expect(recurringState(base, at('2026-11-02T10:00:00+05:30')).nextDueDate).toBe('2026-11-05');
    expect(nextMonth('2026-12')).toBe('2027-01');
  });
});

describe('recurring items API', () => {
  beforeAll(startDb);
  afterAll(stopDb);
  beforeEach(clearDb);
  const allowance = { kind: 'income', name: 'Monthly allowance', amount: 8000, dayOfMonth: 1, source: 'parents' };

  it('never records money until confirmed, then records exactly once', async () => {
    const { agent } = await signup();
    const created = await agent.post('/api/recurring').send(allowance);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ amountPaise: 800_000, due: true, startMonth: currentMonthIST() });
    expect(await balance(agent)).toBe(0); // due, but nothing posted by itself
    expect((await agent.get('/api/recurring')).body.data.dueCount).toBe(1);

    const confirm = await agent.post(`/api/recurring/${created.body.data.id}/confirm`).send({});
    expect(confirm.status).toBe(201);
    expect(confirm.body.data.created.amountPaise).toBe(800_000);
    expect(await balance(agent)).toBe(800_000);
    expect((await agent.get('/api/income/parent-summary')).body.data.thisMonthPaise).toBe(800_000);
    expect(confirm.body.data.recurring.due).toBe(false);

    const again = await agent.post(`/api/recurring/${created.body.data.id}/confirm`).send({});
    expect(again.status).toBe(409);
    expect(await balance(agent)).toBe(800_000);
  });

  it('lets you change the amount when confirming (a short month)', async () => {
    const { agent } = await signup();
    const r = await agent.post('/api/recurring').send(allowance);
    const confirm = await agent.post(`/api/recurring/${r.body.data.id}/confirm`).send({ amount: '6500.50' });
    expect(confirm.body.data.created.amountPaise).toBe(650_050);
    expect(await balance(agent)).toBe(650_050);
  });

  it('two simultaneous confirmations record once', async () => {
    const { agent } = await signup();
    const r = await agent.post('/api/recurring').send(allowance);
    const res = await Promise.all([1, 2, 3].map(() => agent.post(`/api/recurring/${r.body.data.id}/confirm`).send({})));
    expect(res.filter((x) => x.status === 201)).toHaveLength(1);
    expect(await balance(agent)).toBe(800_000);
  });

  it('skip marks the month done without recording; expenses go through the category rules', async () => {
    const { agent } = await signup();
    const mess = await agent.post('/api/recurring').send({ kind: 'expense', name: 'Mess fee', amount: 3500, dayOfMonth: 1, category: 'Mess' });
    expect(mess.status).toBe(201);
    expect((await agent.post(`/api/recurring/${mess.body.data.id}/skip`)).body.data.due).toBe(false);
    expect(await balance(agent)).toBe(0);
    expect((await agent.post(`/api/recurring/${mess.body.data.id}/skip`)).status).toBe(409);
    const rent = await agent.post('/api/recurring').send({ kind: 'expense', name: 'Recharge', amount: 299, dayOfMonth: 1, category: 'Mobile Recharge' });
    await agent.post(`/api/recurring/${rent.body.data.id}/confirm`).send({});
    expect(await balance(agent)).toBe(-29_900);
    expect((await agent.get('/api/expenses?category=Mobile Recharge')).body.data).toHaveLength(1);
    expect((await agent.post('/api/recurring').send({ kind: 'expense', name: 'X', amount: 5, dayOfMonth: 1, category: 'NoSuchCategory' })).status).toBe(400);
  });

  it('not-yet-due items cannot be confirmed; paused items are ignored; validation works', async () => {
    const { agent } = await signup();
    const future = await agent.post('/api/recurring').send({ ...allowance, startMonth: '2099-01' });
    const res = await agent.post(`/api/recurring/${future.body.data.id}/confirm`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Not due yet/);
    expect(await balance(agent)).toBe(0);
    const paused = await agent.post('/api/recurring').send({ ...allowance, name: 'Paused', active: false });
    expect((await agent.post(`/api/recurring/${paused.body.data.id}/confirm`).send({})).status).toBe(400);
    expect((await agent.get('/api/recurring')).body.data.dueCount).toBe(0);
    for (const bad of [{ ...allowance, dayOfMonth: 31 }, { ...allowance, dayOfMonth: 0 }, { ...allowance, source: undefined }, { ...allowance, amount: 0 }, { kind: 'expense', name: 'x', amount: 1, dayOfMonth: 1 }])
      expect((await agent.post('/api/recurring').send(bad)).status, JSON.stringify(bad)).toBe(400);
  });

  it('edit and delete work; other users cannot touch your items; due items notify once', async () => {
    const a = await signup('alice');
    const b = await signup('bob');
    const r = await a.agent.post('/api/recurring').send(allowance);
    const id = r.body.data.id;
    expect((await a.agent.patch(`/api/recurring/${id}`).send({ amount: 9000, active: true })).body.data.amountPaise).toBe(900_000);
    for (const [m, u, body] of [['get', '/api/recurring/' + id], ['patch', '/api/recurring/' + id, { amount: 1 }], ['delete', '/api/recurring/' + id], ['post', `/api/recurring/${id}/confirm`, {}], ['post', `/api/recurring/${id}/skip`, {}]] as const) {
      if (m === 'get') continue; // there is no GET by id; the list is the read path
      const req = (b.agent as any)[m](u); const res = await (body ? req.send(body) : req.send());
      expect(res.status, `${m} ${u}`).toBe(404);
    }
    expect((await b.agent.get('/api/recurring')).body.data.items).toHaveLength(0);
    const n1 = (await a.agent.get('/api/notifications')).body.data.items.filter((n: { type: string }) => n.type === 'recurring_due');
    const n2 = (await a.agent.get('/api/notifications')).body.data.items.filter((n: { type: string }) => n.type === 'recurring_due');
    expect(n1).toHaveLength(1);
    expect(n2).toHaveLength(1);
    await a.agent.delete(`/api/recurring/${id}`);
    expect((await a.agent.get('/api/recurring')).body.data.items).toHaveLength(0);
    await b.agent.patch('/api/users/me').send({ preferences: { notifications: { recurring: false } } });
    await b.agent.post('/api/recurring').send(allowance);
    expect((await b.agent.get('/api/notifications')).body.data.items.filter((n: { type: string }) => n.type === 'recurring_due')).toHaveLength(0);
  });
});
