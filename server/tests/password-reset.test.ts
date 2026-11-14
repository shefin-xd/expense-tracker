import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PasswordReset } from '../src/models/PasswordReset';
import { User } from '../src/models/User';
import { outbox } from '../src/services/email.service';
import { anonymous, clearDb, signup, startDb, stopDb } from './helpers';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => { await clearDb(); outbox.length = 0; });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tokenFrom = (mail: { text: string }) => /reset-password\?token=([a-f0-9]{64})/.exec(mail.text)![1]!;

describe('forgot and reset password', () => {
  it('emails a one-time link and stores only a hash of the token', async () => {
    const { email } = await signup('alice');
    const res = await anonymous().post('/api/auth/forgot-password').send({ email: email.toUpperCase() });
    expect(res.status).toBe(200);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe(email);
    // the link points at the separate sign-in app (AUTH_URL), not the expenses app
    expect(outbox[0]!.text).toContain('http://localhost:5174/reset-password?token=');
    expect(outbox[0]!.html).toContain('reset-password?token=');
    const token = tokenFrom(outbox[0]!);
    const stored = await PasswordReset.find();
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 55 * 60_000);
  });

  it('answers identically for unknown emails and sends nothing', async () => {
    const { email } = await signup('alice');
    const known = await anonymous().post('/api/auth/forgot-password').send({ email });
    const unknown = await anonymous().post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(outbox).toHaveLength(1);
    expect((await anonymous().post('/api/auth/forgot-password').send({ email: 'not-an-email' })).status).toBe(400);
  });

  it('resets the password once; the link then stops working', async () => {
    const { email } = await signup('alice');
    await anonymous().post('/api/auth/forgot-password').send({ email });
    const token = tokenFrom(outbox[0]!);
    const ok = await anonymous().post('/api/auth/reset-password').send({ token, password: 'BrandNew123' });
    expect(ok.status).toBe(200);
    expect((await anonymous().post('/api/auth/login').send({ email, password: 'Passw0rd!x' })).status).toBe(401);
    expect((await anonymous().post('/api/auth/login').send({ email, password: 'BrandNew123' })).status).toBe(200);
    const again = await anonymous().post('/api/auth/reset-password').send({ token, password: 'Another456' });
    expect(again.status).toBe(400);
    expect(again.body.error.message).toMatch(/expired or was already used/);
  });

  it('only the newest link works', async () => {
    const { email } = await signup('alice');
    await anonymous().post('/api/auth/forgot-password').send({ email });
    await anonymous().post('/api/auth/forgot-password').send({ email });
    expect((await anonymous().post('/api/auth/reset-password').send({ token: tokenFrom(outbox[0]!), password: 'BrandNew123' })).status).toBe(400);
    expect((await anonymous().post('/api/auth/reset-password').send({ token: tokenFrom(outbox[1]!), password: 'BrandNew123' })).status).toBe(200);
  });

  it('rejects expired, malformed, guessed and weak-password requests', async () => {
    const { email } = await signup('alice');
    await anonymous().post('/api/auth/forgot-password').send({ email });
    const token = tokenFrom(outbox[0]!);
    expect((await anonymous().post('/api/auth/reset-password').send({ token, password: 'short' })).status).toBe(400);
    expect((await anonymous().post('/api/auth/reset-password').send({ token: 'abc', password: 'BrandNew123' })).status).toBe(400);
    expect((await anonymous().post('/api/auth/reset-password').send({ token: 'a'.repeat(64), password: 'BrandNew123' })).status).toBe(400);
    await PasswordReset.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect((await anonymous().post('/api/auth/reset-password').send({ token, password: 'BrandNew123' })).status).toBe(400);
    expect((await anonymous().post('/api/auth/login').send({ email, password: 'Passw0rd!x' })).status).toBe(200); // password untouched
  });

  it('a reset signs out sessions that were open before it', async () => {
    const { email, agent } = await signup('alice');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await sleep(1100); // tokens carry whole-second timestamps
    await anonymous().post('/api/auth/forgot-password').send({ email });
    await anonymous().post('/api/auth/reset-password').send({ token: tokenFrom(outbox[0]!), password: 'BrandNew123' });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect((await agent.get('/api/expenses')).status).toBe(401);
  });
});

describe('session safety', () => {
  it('changing your password keeps this device signed in but ends other sessions', async () => {
    const { email, agent } = await signup('alice');
    const other = await anonymous().post('/api/auth/login').send({ email, password: 'Passw0rd!x' });
    const otherCookie = String(other.headers['set-cookie']).split(';')[0]!;
    await sleep(1100);
    expect((await agent.post('/api/users/me/password').send({ currentPassword: 'Passw0rd!x', newPassword: 'NewPassw0rd' })).status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await anonymous().get('/api/auth/me').set('Cookie', otherCookie)).status).toBe(401);
  });

  it('a deleted account\'s old cookie no longer works', async () => {
    const { agent, id } = await signup('alice');
    const cookie = (await anonymous().post('/api/auth/login').send({ email: (await User.findById(id))!.email, password: 'Passw0rd!x' })).headers['set-cookie'];
    await agent.delete('/api/users/me').send({ password: 'Passw0rd!x' });
    expect((await anonymous().get('/api/expenses').set('Cookie', String(cookie).split(';')[0]!)).status).toBe(401);
  });

  it('a user with a forged-looking subject is refused', async () => {
    expect((await anonymous().get('/api/expenses').set('Cookie', 'cl_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad')).status).toBe(401);
  });
});
