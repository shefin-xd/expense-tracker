import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonymous, clearDb, signup, startDb, stopDb } from './helpers';

beforeAll(startDb);
afterAll(stopDb);

describe('auth', () => {
  it('registers, sets an HTTP-only cookie, and returns the profile without secrets', async () => {
    await clearDb();
    const res = await anonymous().post('/api/auth/register').send({
      name: 'Shefin', email: 'Shefin@Example.com', password: 'Passw0rd!x', department: 'CSE', studentYear: 'First Year', college: 'CET', hostel: "Men's Hostel",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('shefin@example.com');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Passw0rd/);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('rejects duplicate emails, weak passwords and bad logins', async () => {
    await clearDb();
    const { email } = await signup();
    const dup = await anonymous().post('/api/auth/register').send({ name: 'X', email, password: 'Passw0rd!x', department: 'CSE', studentYear: 'First Year' });
    expect(dup.status).toBe(409);
    const weak = await anonymous().post('/api/auth/register').send({ name: 'X', email: 'new@example.com', password: 'short', department: 'CSE', studentYear: 'First Year' });
    expect(weak.status).toBe(400);
    expect((await anonymous().post('/api/auth/login').send({ email, password: 'wrong-pass1' })).status).toBe(401);
    expect((await anonymous().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Passw0rd!x' })).status).toBe(401);
  });

  it('keeps a session across requests, then logs out', async () => {
    await clearDb();
    const { agent } = await signup();
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('logs in with the right password and changes it', async () => {
    await clearDb();
    const { agent, email } = await signup();
    expect((await agent.post('/api/users/me/password').send({ currentPassword: 'bad', newPassword: 'NewPassw0rd' })).status).toBe(401);
    expect((await agent.post('/api/users/me/password').send({ currentPassword: 'Passw0rd!x', newPassword: 'NewPassw0rd' })).status).toBe(200);
    expect((await anonymous().post('/api/auth/login').send({ email, password: 'Passw0rd!x' })).status).toBe(401);
    expect((await anonymous().post('/api/auth/login').send({ email, password: 'NewPassw0rd' })).status).toBe(200);
  });
});
