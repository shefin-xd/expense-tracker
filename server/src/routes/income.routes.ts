import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { idempotent } from '../middleware/idempotency';
import { bodyOf, queryOf, validateBody, validateQuery } from '../middleware/validate';
import { createIncome, deleteIncome, getIncome, listIncome, parentAllowanceSummary, updateIncome } from '../services/income.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, parseId } from '../utils/http';
import { incomeCreateSchema, incomeListSchema, incomeUpdateSchema } from '../validators/income.validators';

export const incomeRouter = Router();
incomeRouter.use(requireAuth, idempotent);

incomeRouter.get('/parent-summary', asyncHandler(async (req, res) => ok(res, await parentAllowanceSummary(req.userId!))));
incomeRouter.get('/', validateQuery(incomeListSchema), asyncHandler(async (req, res) => {
  const { items, meta } = await listIncome(req.userId!, queryOf(res, incomeListSchema));
  ok(res, items, 200, meta);
}));
incomeRouter.post('/', validateBody(incomeCreateSchema), asyncHandler(async (req, res) => {
  ok(res, await createIncome(req.userId!, bodyOf(req, incomeCreateSchema)), 201);
}));
incomeRouter.get('/:id', asyncHandler(async (req, res) => ok(res, await getIncome(req.userId!, parseId(req.params.id)))));
incomeRouter.patch('/:id', validateBody(incomeUpdateSchema), asyncHandler(async (req, res) => {
  ok(res, await updateIncome(req.userId!, parseId(req.params.id), bodyOf(req, incomeUpdateSchema)));
}));
incomeRouter.delete('/:id', asyncHandler(async (req, res) => {
  await deleteIncome(req.userId!, parseId(req.params.id));
  ok(res, null);
}));
