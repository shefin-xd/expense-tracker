import type { CookieOptions, Request, Response } from 'express';
import { env, isProd } from '../config/env';
import { COOKIE_NAME, signToken } from '../middleware/auth';
import { getUserById, loginUser, registerUser } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  domain: env.COOKIE_DOMAIN,
  path: '/',
});

function startSession(res: Response, userId: string) {
  res.cookie(COOKIE_NAME, signToken(userId), { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await registerUser(req.body);
  startSession(res, user.id);
  res.status(201).json({ success: true, data: { user } });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const user = await loginUser(req.body);
  startSession(res, user.id);
  res.json({ success: true, data: { user } });
});

export const logout = (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ success: true, data: null });
};

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: { user: await getUserById(req.userId!) } });
});
