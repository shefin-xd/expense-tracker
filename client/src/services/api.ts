import type { PageMeta } from '@/types/api';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'ERROR', public details?: { path: string; message: string }[]) {
    super(message);
  }
}

let onUnauthorized: (() => void) | undefined;
/** Registered once by the app: called when any request (other than login attempts) comes back 401. */
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

type Query = Record<string, string | number | boolean | undefined | null>;
const qs = (q?: Query) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q ?? {})) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function raw(method: string, path: string, opts: { body?: unknown; query?: Query } = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}${qs(opts.query)}`, {
      method,
      credentials: 'include',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', 'NETWORK');
  }
  if (!res.ok) {
    let payload: { error?: { message?: string; code?: string; details?: { path: string; message: string }[] } } = {};
    try { payload = await res.json(); } catch { /* non-JSON error body */ }
    const authAttempt = path === '/auth/login' || path === '/auth/register' || path === '/users/me' && method === 'DELETE';
    if (res.status === 401 && !authAttempt && path !== '/auth/me') onUnauthorized?.();
    const detail = payload.error?.details?.[0];
    throw new ApiError(res.status, detail ? `${detail.path ? `${detail.path}: ` : ''}${detail.message}` : payload.error?.message ?? 'Something went wrong. Please try again.', payload.error?.code, payload.error?.details);
  }
  return res;
}

async function json<T>(method: string, path: string, opts?: { body?: unknown; query?: Query }): Promise<{ data: T; meta?: PageMeta }> {
  const res = await raw(method, path, opts);
  return (await res.json()) as { data: T; meta?: PageMeta };
}

export const api = {
  get: async <T>(path: string, query?: Query) => (await json<T>('GET', path, { query })).data,
  page: async <T>(path: string, query?: Query) => {
    const r = await json<T[]>('GET', path, { query });
    return { items: r.data, meta: r.meta! };
  },
  post: async <T>(path: string, body?: unknown) => (await json<T>('POST', path, { body: body ?? {} })).data,
  patch: async <T>(path: string, body: unknown) => (await json<T>('PATCH', path, { body })).data,
  put: async <T>(path: string, body: unknown) => (await json<T>('PUT', path, { body })).data,
  del: async <T = null>(path: string, body?: unknown) => (await json<T>('DELETE', path, { body })).data,
  /** Downloads a file response (reports, data export) through the signed-in session. */
  async download(path: string, query: Query, fallbackName: string) {
    const res = await raw('GET', path, { query });
    const blob = await res.blob();
    const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = match?.[1] ?? fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
