import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AuthRoutes } from './App';

type Handler = (req: { method: string; path: string; body: any }) => { status?: number; data?: unknown; error?: { code?: string; message: string } } | undefined;

/** Replaces fetch with a tiny in-memory API. */
export function mockApi(handler: Handler) {
  const calls: { method: string; path: string; body: any }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const path = new URL(url, 'http://localhost').pathname.replace(/^\/api/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const r = handler({ method, path, body }) ?? { status: 404, error: { message: 'Not found' } };
    const status = r.status ?? 200;
    return new Response(JSON.stringify(status < 400 ? { success: true, data: r.data ?? null } : { success: false, error: r.error }), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return calls;
}
export const SIGNED_OUT = { status: 401, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
export const renderAt = (route: string, ui?: ReactElement) => render(<MemoryRouter initialEntries={[route]}>{ui ?? <AuthRoutes />}</MemoryRouter>);
