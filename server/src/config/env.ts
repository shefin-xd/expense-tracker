import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().url(),
  // The separate sign-in app (e.g. https://auth.shefin.dev). Defaults to CLIENT_URL so single-site setups keep working.
  AUTH_URL: z.string().url().optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  // Email goes through Mailtrap's HTTP API (works on hosts that block SMTP ports, such as Render's free plan).
  MAILTRAP_API_TOKEN: z.string().optional().transform((v) => (v ? v : undefined)),
  // Set only to send into a Mailtrap *testing inbox* (nothing reaches real inboxes). Leave empty for live sending.
  MAILTRAP_INBOX_ID: z.string().regex(/^\d+$/, 'MAILTRAP_INBOX_ID must be the numeric inbox id').optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  EMAIL_FROM: z.string().default('CampusLedger <no-reply@localhost>'),
  COOKIE_DOMAIN: z.string().optional().transform((v) => (v ? v : undefined)),
});

const parsed = schema.parse(process.env);
const trim = (u: string) => u.replace(/\/+$/, '');
export const env = { ...parsed, CLIENT_URL: trim(parsed.CLIENT_URL), AUTH_URL: trim(parsed.AUTH_URL ?? parsed.CLIENT_URL) };
/** Browser origins allowed to call the API with cookies: the app and the sign-in app. */
export const allowedOrigins = [...new Set([env.CLIENT_URL, env.AUTH_URL])];

// Fail fast on settings that would silently weaken a production deployment.
if (env.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (!env.CLIENT_URL.startsWith('https://')) problems.push('CLIENT_URL must be an https:// URL in production');
  if (!env.AUTH_URL.startsWith('https://')) problems.push('AUTH_URL must be an https:// URL in production');
  if (/replace-with|change-me|secret-secret/i.test(env.JWT_SECRET)) problems.push('JWT_SECRET still looks like a placeholder');
  if (env.COOKIE_DOMAIN && !env.COOKIE_DOMAIN.startsWith('.')) problems.push('COOKIE_DOMAIN should start with a dot, e.g. .shefin.dev');
  if (problems.length) throw new Error(`Invalid production configuration:\n- ${problems.join('\n- ')}`);
}
export const isProd = env.NODE_ENV === 'production';
