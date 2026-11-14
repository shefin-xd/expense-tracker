import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { allowedOrigins, env, isProd } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();
  if (isProd) app.set('trust proxy', 1); // Render/Railway sit behind a proxy
  app.disable('x-powered-by');

  app.use(helmet());
  // Only the app and the sign-in app may call the API with cookies.
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)), credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
  });

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: () => env.NODE_ENV === 'test',
    }),
    apiRouter,
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
