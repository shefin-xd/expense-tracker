import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { idempotent } from '../middleware/idempotency';
import { bodyOf, validateBody } from '../middleware/validate';
import { createGoal, deleteGoal, listGoals, updateGoal } from '../services/savings.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, parseId } from '../utils/http';
import { goalCreateSchema, goalUpdateSchema } from '../validators/budget.validators';

export const savingsRouter = Router();
savingsRouter.use(requireAuth, idempotent);
savingsRouter.get('/', asyncHandler(async (req, res) => ok(res, await listGoals(req.userId!))));
savingsRouter.post('/', validateBody(goalCreateSchema), asyncHandler(async (req, res) => ok(res, await createGoal(req.userId!, bodyOf(req, goalCreateSchema)), 201)));
savingsRouter.patch('/:id', validateBody(goalUpdateSchema), asyncHandler(async (req, res) => ok(res, await updateGoal(req.userId!, parseId(req.params.id), bodyOf(req, goalUpdateSchema)))));
savingsRouter.delete('/:id', asyncHandler(async (req, res) => { await deleteGoal(req.userId!, parseId(req.params.id)); ok(res, null); }));
