import { z } from 'zod';
import { amountField, dateField, optionalText, pageQuery } from './common';

const base = z.object({
  person: z.string().trim().min(1).max(100),
  amount: amountField,
  date: dateField,
  expectedDate: dateField.optional(),
  notes: optionalText(1000),
});
export const loanCreateSchema = base.transform(({ amount, ...r }) => ({ ...r, amountPaise: amount }));
export const loanUpdateSchema = base
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')
  .transform(({ amount, ...r }) => ({ ...r, ...(amount !== undefined ? { amountPaise: amount } : {}) }));
export const loanListSchema = z.object({
  ...pageQuery,
  status: z.enum(['pending', 'partially_settled', 'settled', 'overdue']).optional(),
  search: z.string().trim().max(100).optional(),
});
export const repaymentSchema = z
  .object({ amount: amountField, date: dateField.optional(), notes: optionalText(300) })
  .transform(({ amount, ...r }) => ({ ...r, amountPaise: amount }));
