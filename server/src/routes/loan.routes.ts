import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { bodyOf, queryOf, validateBody, validateQuery } from '../middleware/validate';
import { addRepayment, createLoan, deleteLoan, deleteRepayment, getLoan, listLoans, loanTotals, updateLoan, type Direction } from '../services/loan.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, parseId } from '../utils/http';
import { loanCreateSchema, loanListSchema, loanUpdateSchema, repaymentSchema } from '../validators/loan.validators';

/** Mounted twice: /api/lending (money I lent) and /api/borrowing (money I borrowed). */
export function makeLoanRouter(direction: Direction) {
  const r = Router();
  r.use(requireAuth);
  r.get('/summary', asyncHandler(async (req, res) => ok(res, await loanTotals(req.userId!, direction))));
  r.get('/', validateQuery(loanListSchema), asyncHandler(async (req, res) => {
    const { items, meta } = await listLoans(req.userId!, direction, queryOf(res, loanListSchema));
    ok(res, items, 200, meta);
  }));
  r.post('/', validateBody(loanCreateSchema), asyncHandler(async (req, res) => ok(res, await createLoan(req.userId!, direction, bodyOf(req, loanCreateSchema)), 201)));
  r.get('/:id', asyncHandler(async (req, res) => ok(res, await getLoan(req.userId!, direction, parseId(req.params.id)))));
  r.patch('/:id', validateBody(loanUpdateSchema), asyncHandler(async (req, res) => ok(res, await updateLoan(req.userId!, direction, parseId(req.params.id), bodyOf(req, loanUpdateSchema)))));
  r.delete('/:id', asyncHandler(async (req, res) => { await deleteLoan(req.userId!, direction, parseId(req.params.id)); ok(res, null); }));
  r.post('/:id/repayments', validateBody(repaymentSchema), asyncHandler(async (req, res) => ok(res, await addRepayment(req.userId!, direction, parseId(req.params.id), bodyOf(req, repaymentSchema)), 201)));
  r.delete('/:id/repayments/:repaymentId', asyncHandler(async (req, res) => ok(res, await deleteRepayment(req.userId!, direction, parseId(req.params.id), parseId(req.params.repaymentId)))));
  return r;
}
