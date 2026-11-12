import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/User';
import { unauthorized } from '../utils/errors';

export const COOKIE_NAME = 'cl_token';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Sets req.userId. Every data query downstream must filter by it. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) return next(unauthorized());
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  } catch {
    return next(unauthorized('Session expired. Please sign in again.'));
  }
  if (typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub)) return next(unauthorized());
  try {
    // One indexed lookup per request: deleted accounts and sessions from before a password change stop working at once.
    const user = await User.findById(payload.sub).select('passwordChangedAt');
    if (!user) return next(unauthorized('Session expired. Please sign in again.'));
    const changed = user.passwordChangedAt ? Math.floor(user.passwordChangedAt.getTime() / 1000) : 0;
    if ((payload.iat ?? 0) < changed) return next(unauthorized('Your password changed. Please sign in again.'));
    req.userId = payload.sub;
    next();
  } catch (e) {
    next(e);
  }
};
