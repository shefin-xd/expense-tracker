import { z } from 'zod';
import { assertPaise, rupeesToPaise } from '../utils/money';

/** API accepts rupees as number or string ("1,250.50") and turns them into integer paise. */
export const amountField = z.union([z.string(), z.number()]).transform((v, ctx) => {
  try {
    const paise = rupeesToPaise(v);
    assertPaise(paise);
    return paise;
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: (e as Error).message });
    return z.NEVER;
  }
});

/** Same, but zero is allowed (e.g. amount saved so far). */
export const amountOrZeroField = z.union([z.string(), z.number()]).transform((v, ctx) => {
  try {
    const paise = rupeesToPaise(v);
    if (paise !== 0) assertPaise(paise);
    return paise;
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: (e as Error).message });
    return z.NEVER;
  }
});

export const dateField = z.coerce.date();
export const optionalText = (max: number) => z.string().trim().max(max).optional();

export const toPaise = <T extends { amount: number }>({ amount, ...rest }: T) => ({ ...rest, amountPaise: amount });
export const toPaiseOpt = <T extends { amount?: number }>({ amount, ...rest }: T) => ({
  ...rest,
  ...(amount !== undefined ? { amountPaise: amount } : {}),
});

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
export const rangeQuery = { from: z.coerce.date().optional(), to: z.coerce.date().optional() };
export const order = z.enum(['asc', 'desc']).default('desc');
