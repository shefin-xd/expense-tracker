import { z } from 'zod';
import { amountField, amountOrZeroField, dateField, optionalText } from './common';

export const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-11');

export const budgetSchema = z
  .object({
    overall: amountField.optional(),
    categories: z.array(z.object({ category: z.string().trim().min(1).max(40), limit: amountField })).max(30).default([]),
  })
  .refine((v) => v.overall !== undefined || v.categories.length > 0, 'Set an overall limit or at least one category limit')
  .refine((v) => new Set(v.categories.map((c) => c.category.toLowerCase())).size === v.categories.length, 'Duplicate category in budget')
  .transform((v) => ({ overallPaise: v.overall, categories: v.categories.map((c) => ({ category: c.category, limitPaise: c.limit })) }));

const goalBase = z.object({
  name: z.string().trim().min(1).max(100),
  target: amountField,
  saved: amountOrZeroField.default(0),
  targetDate: dateField.optional(),
  description: optionalText(500),
});
export const goalCreateSchema = goalBase.transform(({ target, saved, ...r }) => ({ ...r, targetPaise: target, savedPaise: saved }));
export const goalUpdateSchema = goalBase
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')
  .transform(({ target, saved, ...r }) => ({
    ...r,
    ...(target !== undefined ? { targetPaise: target } : {}),
    ...(saved !== undefined ? { savedPaise: saved } : {}),
  }));
