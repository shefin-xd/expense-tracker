const clean = (u: string) => u.trim().replace(/\/+$/, '');

export const API_BASE = clean((import.meta.env.VITE_API_URL as string | undefined) ?? '');
/** The app people are sent back to after signing in. */
export const APP_URL = clean((import.meta.env.VITE_APP_URL as string | undefined) ?? 'http://localhost:5173');

const origins = (list: string[]) => list.map(clean).filter(Boolean).flatMap((u) => { try { return [new URL(u).origin]; } catch { return []; } });
/** The only origins a `?redirect=` may point to. */
export const ALLOWED_REDIRECTS = [...new Set(origins([APP_URL, ...(((import.meta.env.VITE_ALLOWED_REDIRECTS as string | undefined) ?? '').split(','))]))];
