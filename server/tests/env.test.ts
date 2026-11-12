import { afterEach, describe, expect, it, vi } from 'vitest';

const GOOD = { NODE_ENV: 'production', MONGODB_URI: 'mongodb://x/y', JWT_SECRET: 'k3J9xQ2mZ8vL5nB7tR4wY6uP1sD0fG3hA9cE', CLIENT_URL: 'https://expenses.shefin.dev', COOKIE_DOMAIN: '.shefin.dev' };

async function load(over: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...GOOD, ...over })) vi.stubEnv(k, v);
  return import('../src/config/env.js');
}
afterEach(() => vi.unstubAllEnvs());

describe('production configuration checks', () => {
  it('accepts a correct production setup', async () => {
    const { env, isProd } = await load({});
    expect(isProd).toBe(true);
    expect(env.COOKIE_DOMAIN).toBe('.shefin.dev');
  });
  it('refuses http client URLs, placeholder secrets and cookie domains without a leading dot', async () => {
    await expect(load({ CLIENT_URL: 'http://expenses.shefin.dev' })).rejects.toThrow(/https/);
    await expect(load({ JWT_SECRET: 'replace-with-at-least-32-random-characters' })).rejects.toThrow(/placeholder/);
    await expect(load({ COOKIE_DOMAIN: 'shefin.dev' })).rejects.toThrow(/start with a dot/);
  });
  it('still requires the basics in every environment', async () => {
    await expect(load({ JWT_SECRET: 'too-short' })).rejects.toThrow(/32 characters/);
    await expect(load({ MONGODB_URI: '' })).rejects.toThrow();
  });
  it('does not apply production rules in development', async () => {
    const { env } = await load({ NODE_ENV: 'development', CLIENT_URL: 'http://localhost:5173' });
    expect(env.NODE_ENV).toBe('development');
  });
});
