import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE = { NODE_ENV: 'test', MONGODB_URI: 'mongodb://x/y', JWT_SECRET: 'k3J9xQ2mZ8vL5nB7tR4wY6uP1sD0fG3hA9cE', CLIENT_URL: 'https://expenses.shefin.dev', EMAIL_FROM: 'CampusLedger <no-reply@shefin.dev>' };
const mail = { to: 'student@example.com', subject: 'Reset', text: 'plain', html: '<p>html</p>', category: 'Password reset' };

async function load(over: Record<string, string> = {}) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...BASE, MAILTRAP_API_TOKEN: '', MAILTRAP_INBOX_ID: '', ...over })) vi.stubEnv(k, v);
  return import('../src/services/email.service.js');
}
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, message_ids: ['1'] }), { status: 200 })); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Mailtrap email sending', () => {
  it('live mode posts to the Email API with a bearer token and the right JSON', async () => {
    const svc = await load({ MAILTRAP_API_TOKEN: 'tok_live_123' });
    expect(svc.emailMode()).toBe('live');
    await svc.sendViaMailtrap(mail);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://send.api.mailtrap.io/api/send');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok_live_123', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      from: { email: 'no-reply@shefin.dev', name: 'CampusLedger' }, to: [{ email: 'student@example.com' }],
      subject: 'Reset', text: 'plain', html: '<p>html</p>', category: 'Password reset',
    });
  });

  it('sandbox mode posts to the testing inbox endpoint', async () => {
    const svc = await load({ MAILTRAP_API_TOKEN: 'tok', MAILTRAP_INBOX_ID: '4242' });
    expect(svc.emailMode()).toBe('sandbox');
    await svc.sendViaMailtrap(mail);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://sandbox.api.mailtrap.io/api/send/4242');
    expect(svc.describeEmail()).toMatch(/TESTING inbox 4242/);
  });

  it('without a token it does not call the network', async () => {
    const svc = await load();
    expect(svc.emailMode()).toBe('console');
    expect(svc.describeEmail()).toMatch(/not configured/);
  });

  it('reports Mailtrap errors without leaking the token', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, errors: ['Unauthorized'] }), { status: 401 }));
    const svc = await load({ MAILTRAP_API_TOKEN: 'tok_secret_value' });
    const err = await svc.sendViaMailtrap(mail).catch((e: Error) => e);
    expect((err as Error).message).toBe('Mailtrap responded 401: ["Unauthorized"]');
    expect((err as Error).message).not.toContain('tok_secret_value');
    fetchMock.mockResolvedValueOnce(new Response('<html>bad gateway</html>', { status: 502 }));
    await expect(svc.sendViaMailtrap(mail)).rejects.toThrow('Mailtrap responded 502');
  });

  it('parses sender addresses in both styles', async () => {
    const { parseAddress } = await load();
    expect(parseAddress('CampusLedger <no-reply@shefin.dev>')).toEqual({ email: 'no-reply@shefin.dev', name: 'CampusLedger' });
    expect(parseAddress('"Campus, Ledger" <a@b.dev>')).toEqual({ email: 'a@b.dev', name: 'Campus, Ledger' });
    expect(parseAddress('a@b.dev')).toEqual({ email: 'a@b.dev' });
    expect(parseAddress('<a@b.dev>')).toEqual({ email: 'a@b.dev' });
  });

  it('rejects a non-numeric inbox id at startup', async () => {
    await expect(load({ MAILTRAP_API_TOKEN: 'tok', MAILTRAP_INBOX_ID: 'abc' })).rejects.toThrow(/numeric inbox id/);
  });

  it('the reset email escapes names and links in HTML', async () => {
    const { resetEmail } = await load();
    const m = resetEmail('<b>Eve</b>', 'https://x.dev/r?token=a&b=1', 60);
    expect(m.html).toContain('&lt;b&gt;Eve&lt;/b&gt;');
    expect(m.html).toContain('token=a&amp;b=1');
    expect(m.text).toContain('https://x.dev/r?token=a&b=1');
    expect(m.category).toBe('Password reset');
  });
});
