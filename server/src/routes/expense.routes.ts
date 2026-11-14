import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { idempotent } from '../middleware/idempotency';
import { bodyOf, queryOf, validateBody, validateQuery } from '../middleware/validate';
import { createExpense, deleteExpense, getExpense, listExpenses, updateExpense } from '../services/expense.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, parseId } from '../utils/http';
import { expenseCreateSchema, expenseListSchema, expenseUpdateSchema } from '../validators/expense.validators';

export const expenseRouter = Router();
expenseRouter.use(requireAuth, idempotent);

expenseRouter.get('/', validateQuery(expenseListSchema), asyncHandler(async (req, res) => {
  const { items, meta } = await listExpenses(req.userId!, queryOf(res, expenseListSchema));
  ok(res, items, 200, meta);
}));
expenseRouter.post('/', validateBody(expenseCreateSchema), asyncHandler(async (req, res) => {
  ok(res, await createExpense(req.userId!, bodyOf(req, expenseCreateSchema)), 201);
}));
expenseRouter.get('/:id', asyncHandler(async (req, res) => {
  ok(res, await getExpense(req.userId!, parseId(req.params.id)));
}));
expenseRouter.patch('/:id', validateBody(expenseUpdateSchema), asyncHandler(async (req, res) => {
  ok(res, await updateExpense(req.userId!, parseId(req.params.id), bodyOf(req, expenseUpdateSchema)));
}));
expenseRouter.delete('/:id', asyncHandler(async (req, res) => {
  await deleteExpense(req.userId!, parseId(req.params.id));
  ok(res, null);
}));
