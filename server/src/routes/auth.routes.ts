import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, me, register } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema } from '../validators/auth.validators';

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
