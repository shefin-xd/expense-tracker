import { z } from 'zod';
import { FEE_CATEGORIES } from '../models/constants';
import { amountField, dateField, optionalText, pageQuery } from './common';

const feeBase = z.object({
  title: z.string().trim().min(1).max(150),
  category: z.enum(FEE_CATEGORIES),
  academicYear: z.string().trim().min(1).max(20),
  total: amountField,
  dueDate: dateField,
  notes: optionalText(1000),
});
const feeShape = ({ total, ...rest }: z.output<typeof feeBase>) => ({ ...rest, totalPaise: total });
export const feeCreateSchema = feeBase.transform(feeShape);
export const feeUpdateSchema = feeBase
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')
  .transform(({ total, ...rest }) => ({ ...rest, ...(total !== undefined ? { totalPaise: total } : {}) }));

export const feeListSchema = z.object({
  ...pageQuery,
  academicYear: z.string().trim().max(20).optional(),
  status: z.enum(['paid', 'partially_paid', 'pending', 'overdue']).optional(),
});

export const paymentSchema = z
  .object({ amount: amountField, date: dateField.optional(), referenceNo: optionalText(80), notes: optionalText(500) })
  .transform(({ amount, ...rest }) => ({ ...rest, amountPaise: amount }));
