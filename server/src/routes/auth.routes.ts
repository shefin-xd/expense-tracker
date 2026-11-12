import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { forgotPassword, login, logout, me, register, resetPasswordHandler } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { forgotSchema, loginSchema, registerSchema, resetSchema } from '../validators/auth.validators';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

export const authRouter = Router();
authRouter.post('/register', authLimiter, validateBody(registerSchema), register);
authRouter.post('/login', authLimiter, validateBody(loginSchema), login);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);

const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' });
authRouter.post('/forgot-password', resetLimiter, validateBody(forgotSchema), forgotPassword);
authRouter.post('/reset-password', resetLimiter, validateBody(resetSchema), resetPasswordHandler);
