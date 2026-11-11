import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().min(1),
  COOKIE_DOMAIN: z.string().optional().transform((v) => (v ? v : undefined)),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';
export const clientOrigins = env.CLIENT_URL.split(',').map((v) => v.trim()).filter(Boolean);
