import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { idempotent } from '../middleware/idempotency';
import { bodyOf, queryOf, validateBody, validateQuery } from '../middleware/validate';
import { addPayment, completeFee, createFee, deleteFee, deletePayment, getFee, listFees, updateFee } from '../services/fee.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, parseId } from '../utils/http';
import { feeCreateSchema, feeListSchema, feeUpdateSchema, paymentSchema } from '../validators/fee.validators';

export const feeRouter = Router();
feeRouter.use(requireAuth, idempotent);

feeRouter.get('/', validateQuery(feeListSchema), asyncHandler(async (req, res) => {
  const { items, meta } = await listFees(req.userId!, queryOf(res, feeListSchema));
  ok(res, items, 200, meta);
}));
feeRouter.post('/', validateBody(feeCreateSchema), asyncHandler(async (req, res) => ok(res, await createFee(req.userId!, bodyOf(req, feeCreateSchema)), 201)));
feeRouter.get('/:id', asyncHandler(async (req, res) => ok(res, await getFee(req.userId!, parseId(req.params.id)))));
feeRouter.patch('/:id', validateBody(feeUpdateSchema), asyncHandler(async (req, res) => ok(res, await updateFee(req.userId!, parseId(req.params.id), bodyOf(req, feeUpdateSchema)))));
feeRouter.delete('/:id', asyncHandler(async (req, res) => { await deleteFee(req.userId!, parseId(req.params.id)); ok(res, null); }));

feeRouter.post('/:id/payments', validateBody(paymentSchema), asyncHandler(async (req, res) => {
  ok(res, await addPayment(req.userId!, parseId(req.params.id), bodyOf(req, paymentSchema)), 201);
}));
feeRouter.post('/:id/complete', asyncHandler(async (req, res) => {
  const ref = (req.body as { referenceNo?: unknown } | undefined)?.referenceNo;
  const referenceNo = typeof ref === 'string' ? ref.trim().slice(0, 80) || undefined : undefined;
  ok(res, await completeFee(req.userId!, parseId(req.params.id), { referenceNo }), 201);
}));
feeRouter.delete('/:id/payments/:paymentId', asyncHandler(async (req, res) => {
  ok(res, await deletePayment(req.userId!, parseId(req.params.id), parseId(req.params.paymentId)));
}));
