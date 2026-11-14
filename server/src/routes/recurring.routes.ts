import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { idempotent } from '../middleware/idempotency';
import { bodyOf, validateBody } from '../middleware/validate';
import { confirmRecurring, createRecurring, deleteRecurring, listRecurring, skipRecurring, updateRecurring } from '../services/recurring.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, parseId } from '../utils/http';
import { confirmSchema, recurringCreateSchema, recurringUpdateSchema } from '../validators/recurring.validators';

export const recurringRouter = Router();
recurringRouter.use(requireAuth, idempotent);

recurringRouter.get('/', asyncHandler(async (req, res) => ok(res, await listRecurring(req.userId!))));
recurringRouter.post('/', validateBody(recurringCreateSchema), asyncHandler(async (req, res) => ok(res, await createRecurring(req.userId!, bodyOf(req, recurringCreateSchema)), 201)));
recurringRouter.patch('/:id', validateBody(recurringUpdateSchema), asyncHandler(async (req, res) => ok(res, await updateRecurring(req.userId!, parseId(req.params.id), bodyOf(req, recurringUpdateSchema)))));
recurringRouter.delete('/:id', asyncHandler(async (req, res) => { await deleteRecurring(req.userId!, parseId(req.params.id)); ok(res, null); }));
// Nothing is recorded until the user confirms.
recurringRouter.post('/:id/confirm', validateBody(confirmSchema), asyncHandler(async (req, res) => ok(res, await confirmRecurring(req.userId!, parseId(req.params.id), bodyOf(req, confirmSchema)), 201)));
recurringRouter.post('/:id/skip', asyncHandler(async (req, res) => ok(res, await skipRecurring(req.userId!, parseId(req.params.id)))));
