import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProd } from '../config/env';
import { AppError } from '../utils/errors';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ success: false, error: { code: err.code, message: err.message, details: err.details } });
  }
  if ((err as { code?: number })?.code === 11000) {
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Duplicate record' } });
  }
  if (err instanceof RangeError) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message } });
  }
  if (!isProd) console.error(err);
  else console.error('Unhandled error:', (err as Error)?.message);
  res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
