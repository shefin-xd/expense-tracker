import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

// These cases are rejected before any database call, so they run without MongoDB.
const app = createApp();

describe('auth http (no database needed)', () => {
  it('health check works', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('/me requires authentication', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('/me rejects a forged token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'cl_token=not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('register validates input', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('login validates input', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('unknown routes return 404 JSON', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
