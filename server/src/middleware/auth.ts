import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from '../utils/errors';

export const COOKIE_NAME = 'cl_token';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Sets req.userId. Every data query downstream must filter by it. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string') return next(unauthorized());
    req.userId = payload.sub;
    next();
  } catch {
    next(unauthorized('Session expired. Please sign in again.'));
  }
};
