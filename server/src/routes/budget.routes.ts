import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { bodyOf, validateBody } from '../middleware/validate';
import { compareMonths, getBudgetProgress, upsertBudget } from '../services/budget.service';
import { asyncHandler } from '../utils/asyncHandler';
import { currentMonthIST } from '../utils/dates';
import { badRequest } from '../utils/errors';
import { ok } from '../utils/http';
import { budgetSchema, monthParam } from '../validators/budget.validators';

export const budgetRouter = Router();
budgetRouter.use(requireAuth);

const month = (v: unknown) => {
  const r = monthParam.safeParse(v === 'current' ? currentMonthIST() : v);
  if (!r.success) throw badRequest('Month must look like 2026-11 (or "current")');
  return r.data;
};
// "current" resolves to this month in IST.
budgetRouter.get('/:month', asyncHandler(async (req, res) => ok(res, await getBudgetProgress(req.userId!, month(req.params.month)))));
budgetRouter.get('/:month/compare', asyncHandler(async (req, res) => ok(res, await compareMonths(req.userId!, month(req.params.month)))));
budgetRouter.put('/:month', validateBody(budgetSchema), asyncHandler(async (req, res) => ok(res, await upsertBudget(req.userId!, month(req.params.month), bodyOf(req, budgetSchema)))));
