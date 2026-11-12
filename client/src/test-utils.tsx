import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

export const USER = { id: 'u1', name: 'Shefin Franklin', email: 'shefin@example.com', college: 'College of Engineering Trivandrum', department: 'Computer Science and Engineering', studentYear: 'First Year', hostel: "CET Men's Hostel", preferences: { theme: 'light', dateFormat: 'DD/MM/YYYY' } };

type Handler = (req: { method: string; path: string; query: URLSearchParams; body: any }) => { status?: number; data?: unknown; meta?: unknown; error?: { code: string; message: string } } | undefined;

/** Replaces fetch with a tiny in-memory API so screens can be tested without a server. */
export function mockApi(handler: Handler) {
  const calls: { method: string; path: string; body: any }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const u = new URL(url, 'http://localhost');
    const path = u.pathname.replace(/^\/api/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const r = handler({ method, path, query: u.searchParams, body }) ?? { status: 404, error: { code: 'NOT_FOUND', message: 'Not found' } };
    const status = r.status ?? 200;
    return new Response(JSON.stringify(status < 400 ? { success: true, data: r.data ?? null, ...(r.meta ? { meta: r.meta } : {}) } : { success: false, error: r.error }), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return calls;
}

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return { client, ...render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></QueryClientProvider>) };
}
