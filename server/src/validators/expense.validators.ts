import { z } from 'zod';
import { PAYMENT_METHODS } from '../models/constants';
import { amountField, dateField, order, optionalText, pageQuery, rangeQuery, toPaise, toPaiseOpt } from './common';

const base = z.object({
  title: z.string().trim().min(1).max(150),
  amount: amountField,
  category: z.string().trim().min(1).max(40),
  date: dateField,
  paymentMethod: z.enum(PAYMENT_METHODS).default('upi'),
  description: optionalText(500),
  notes: optionalText(1000),
  receiptUrl: z.string().trim().url().max(500).optional(),
});

export const expenseCreateSchema = base.transform(toPaise);
export const expenseUpdateSchema = base
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')
  .transform(toPaiseOpt);

export const expenseListSchema = z.object({
  ...pageQuery,
  ...rangeQuery,
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(40).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  sortBy: z.enum(['date', 'amount']).default('date'),
  order,
});
