const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '') || '/api';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { path: string; message: string }[]) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

function url(path: string, query?: Query) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return `${BASE}${path}${s ? `?${s}` : ''}`;
}

async function send(method: string, path: string, opts: { body?: unknown; query?: Query } = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url(path, opts.query), {
      method,
      credentials: 'include',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Can’t reach the server. Check your connection and try again.');
  }
  if (res.ok) return res;
  let err: { code?: string; message?: string; details?: ApiError['details'] } = {};
  try { err = ((await res.json()) as { error?: typeof err }).error ?? {}; } catch { /* non-JSON error */ }
  // A 401 means the session is gone, except where the server uses it for "wrong password" on a signed-in account.
  const wrongPasswordCall = path === '/users/me/password' || (method === 'DELETE' && path === '/users/me');
  if (res.status === 401 && !path.startsWith('/auth/') && !wrongPasswordCall) onUnauthorized?.();
  throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? 'Something went wrong. Try again.', err.details);
}

async function json<T>(res: Response) {
  return (await res.json()) as { data: T; meta?: import('./types').PageMeta };
}

export const api = {
  get: async <T>(path: string, query?: Query) => (await json<T>(await send('GET', path, { query }))).data,
  list: async <T>(path: string, query?: Query) => {
    const r = await json<T[]>(await send('GET', path, { query }));
    return { items: r.data, meta: r.meta! } as import('./types').Paged<T>;
  },
  post: async <T>(path: string, body?: unknown) => (await json<T>(await send('POST', path, { body: body ?? {} }))).data,
  put: async <T>(path: string, body: unknown) => (await json<T>(await send('PUT', path, { body }))).data,
  patch: async <T>(path: string, body: unknown) => (await json<T>(await send('PATCH', path, { body }))).data,
  del: async <T = null>(path: string, body?: unknown) => (await json<T>(await send('DELETE', path, { body }))).data,
  /** Fetches a file with the session cookie and returns it as a Blob plus the server-chosen filename. */
  async file(path: string, query?: Query) {
    const res = await send('GET', path, { query });
    const cd = res.headers.get('Content-Disposition') ?? '';
    const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd)?.[1];
    return { blob: await res.blob(), filename: name ? decodeURIComponent(name) : 'campusledger-export' };
  },
};

export function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Maps server validation details ("amount", "categories.0.limit") onto form fields. */
export function serverFieldErrors(err: unknown, known: string[]): { field: string; message: string }[] {
  if (!(err instanceof ApiError) || !err.details) return [];
  return err.details.filter((d) => known.includes(d.path)).map((d) => ({ field: d.path, message: d.message }));
}
