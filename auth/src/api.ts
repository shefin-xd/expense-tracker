import { API_BASE } from './config';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'ERROR') { super(message); }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { method, credentials: 'include', headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', 'NETWORK');
  }
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { message?: string; code?: string; details?: { path: string; message: string }[] } };
  if (!res.ok) {
    const d = json.error?.details?.[0];
    throw new ApiError(res.status, d ? `${d.path ? `${d.path}: ` : ''}${d.message}` : json.error?.message ?? 'Something went wrong. Please try again.', json.error?.code);
  }
  return json.data as T;
}

export interface SessionUser { id: string; name: string; email: string }
export const api = {
  me: () => call<{ user: SessionUser }>('GET', '/auth/me'),
  login: (v: { email: string; password: string }) => call<{ user: SessionUser }>('POST', '/auth/login', v),
  register: (v: Record<string, unknown>) => call<{ user: SessionUser }>('POST', '/auth/register', v),
  forgot: (email: string) => call<unknown>('POST', '/auth/forgot-password', { email }),
  reset: (token: string, password: string) => call<null>('POST', '/auth/reset-password', { token, password }),
};
