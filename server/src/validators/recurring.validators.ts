import { z } from 'zod';
import { INCOME_SOURCES, PAYMENT_METHODS } from '../models/constants';
import { amountField, dateField, optionalText } from './common';

const base = z.object({
  kind: z.enum(['income', 'expense']),
  name: z.string().trim().min(1).max(100),
  amount: amountField,
  dayOfMonth: z.coerce.number().int().min(1, 'Day must be 1 to 28').max(28, 'Day must be 1 to 28'),
  source: z.enum(INCOME_SOURCES).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('upi'),
  notes: optionalText(500),
  active: z.boolean().default(true),
  startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-11').optional(),
});

const needsTarget = (v: { kind?: string | undefined; source?: unknown; category?: unknown }, ctx: z.RefinementCtx) => {
  if (v.kind === 'income' && !v.source) ctx.addIssue({ code: 'custom', path: ['source'], message: 'Choose where this money comes from' });
  if (v.kind === 'expense' && !v.category) ctx.addIssue({ code: 'custom', path: ['category'], message: 'Choose a category' });
};

export const recurringCreateSchema = base.superRefine(needsTarget).transform(({ amount, ...r }) => ({ ...r, amountPaise: amount }));
export const recurringUpdateSchema = base
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')
  .transform(({ amount, ...r }) => ({ ...r, ...(amount !== undefined ? { amountPaise: amount } : {}) }));
export const confirmSchema = z.object({ amount: amountField.optional(), date: dateField.optional() }).transform(({ amount, ...r }) => ({ ...r, ...(amount !== undefined ? { amountPaise: amount } : {}) }));
