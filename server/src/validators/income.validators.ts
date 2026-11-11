import { z } from 'zod';
import { INCOME_SOURCES, PAYMENT_METHODS } from '../models/constants';
import { amountField, dateField, order, optionalText, pageQuery, rangeQuery, toPaise, toPaiseOpt } from './common';

const base = z.object({
  source: z.enum(INCOME_SOURCES),
  amount: amountField,
  date: dateField,
  description: optionalText(500),
  paymentMethod: z.enum(PAYMENT_METHODS).default('upi'),
  notes: optionalText(1000),
});
export const incomeCreateSchema = base.transform(toPaise);
export const incomeUpdateSchema = base.partial().refine((v) => Object.keys(v).length > 0, 'Nothing to update').transform(toPaiseOpt);
export const incomeListSchema = z.object({
  ...pageQuery,
  ...rangeQuery,
  source: z.enum(INCOME_SOURCES).optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['date', 'amount']).default('date'),
  order,
});
