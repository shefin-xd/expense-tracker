import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().url(),
  SMTP_HOST: z.string().optional().transform((v) => (v ? v : undefined)),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().transform((v) => (v ? v : undefined)),
  SMTP_PASS: z.string().optional().transform((v) => (v ? v : undefined)),
  EMAIL_FROM: z.string().default('CampusLedger <no-reply@localhost>'),
  COOKIE_DOMAIN: z.string().optional().transform((v) => (v ? v : undefined)),
});

export const env = schema.parse(process.env);

// Fail fast on settings that would silently weaken a production deployment.
if (env.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (!env.CLIENT_URL.startsWith('https://')) problems.push('CLIENT_URL must be an https:// URL in production');
  if (/replace-with|change-me|secret-secret/i.test(env.JWT_SECRET)) problems.push('JWT_SECRET still looks like a placeholder');
  if (env.COOKIE_DOMAIN && !env.COOKIE_DOMAIN.startsWith('.')) problems.push('COOKIE_DOMAIN should start with a dot, e.g. .shefin.dev');
  if (problems.length) throw new Error(`Invalid production configuration:\n- ${problems.join('\n- ')}`);
}
export const isProd = env.NODE_ENV === 'production';
