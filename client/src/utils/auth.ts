/** Sign-in lives in a separate app (auth.shefin.dev). These helpers build the links to it. */
export const AUTH_URL = ((import.meta.env.VITE_AUTH_URL as string | undefined) ?? 'http://localhost:5174').replace(/\/+$/, '');

export function loginUrl(returnTo: string = window.location.href, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({ redirect: returnTo, ...extra });
  return `${AUTH_URL}/login?${q.toString()}`;
}
export const registerUrl = () => `${AUTH_URL}/register`;

/** Full-page navigation (the sign-in app is a different origin). Swappable in tests. */
export const nav = { go: (url: string) => window.location.assign(url), replace: (url: string) => window.location.replace(url) };
