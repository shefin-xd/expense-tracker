import { z } from 'zod';
import { rupeesToPaise } from './money';

const MAX_PAISE = 100_000_000_00;

/** Amount typed by the user in rupees. Validated as exact paise, never via floating point. */
export const amountText = z.string().trim().min(1, 'Enter an amount').superRefine((v, ctx) => {
  const p = rupeesToPaise(v);
  if (p === null) ctx.addIssue({ code: 'custom', message: 'Use numbers only, like 250 or 250.50' });
  else if (p <= 0) ctx.addIssue({ code: 'custom', message: 'Amount must be more than ₹0' });
  else if (p > MAX_PAISE) ctx.addIssue({ code: 'custom', message: 'That amount is too large' });
});

export const amountTextOrZero = z.string().trim().superRefine((v, ctx) => {
  if (v === '') return;
  const p = rupeesToPaise(v);
  if (p === null) ctx.addIssue({ code: 'custom', message: 'Use numbers only, like 250 or 250.50' });
  else if (p > MAX_PAISE) ctx.addIssue({ code: 'custom', message: 'That amount is too large' });
});

export const dayText = z.string().min(1, 'Choose a date').regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date');
export const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`).optional();
