import { useSearchParams } from 'react-router-dom';
import { ALLOWED_REDIRECTS, APP_URL } from './config';
import { safeRedirect } from './redirect';

/** The validated destination, plus a helper that keeps the `redirect` choice when moving between sign-in pages. */
export function useRedirect() {
  const [params] = useSearchParams();
  const raw = params.get('redirect');
  const target = safeRedirect(raw, ALLOWED_REDIRECTS, `${APP_URL}/`);
  const keep = raw ? `?redirect=${encodeURIComponent(raw)}` : '';
  return { target, link: (path: string, extra = '') => `${path}${keep}${extra ? `${keep ? '&' : '?'}${extra}` : ''}`, params };
}
