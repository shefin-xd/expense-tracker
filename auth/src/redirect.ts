/**
 * Decides where to send someone after they sign in. The `redirect` value comes from the address bar, so it is
 * untrusted: only absolute http(s) URLs on an allowed origin, without embedded credentials, are accepted.
 * Anything else (relative paths, //evil.com, javascript:, look-alike hosts) falls back to the default app.
 */
export function safeRedirect(raw: string | null | undefined, allowedOrigins: string[], fallback: string): string {
  if (!raw) return fallback;
  let url: URL;
  try { url = new URL(raw); } catch { return fallback; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
  if (url.username || url.password) return fallback;
  if (!allowedOrigins.includes(url.origin)) return fallback;
  return url.toString();
}
