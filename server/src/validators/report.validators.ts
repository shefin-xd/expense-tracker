import { z } from 'zod';
import { endOfDayIST, startOfDayIST } from '../utils/dates';

export const REPORT_SCOPES = ['all', 'expenses', 'income', 'fees'] as const;
export const CSV_SECTIONS = ['summary', 'transactions', 'income', 'expenses', 'fees', 'fee_payments', 'lent', 'borrowed', 'budgets', 'savings', 'categories'] as const;
const MAX_RANGE_DAYS = 366 * 5;

const reportBase = z.object({
  scope: z.enum(REPORT_SCOPES).default('all'),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-11').optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

function checkRange(q: { from?: Date | undefined; to?: Date | undefined }, ctx: z.RefinementCtx) {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message, path: ['to'] });
  if ((q.from === undefined) !== (q.to === undefined)) return issue('Provide both from and to');
  if (!q.from || !q.to) return;
  if (q.from > q.to) return issue('from must not be after to');
  if ((endOfDayIST(q.to).getTime() - startOfDayIST(q.from).getTime()) / 86_400_000 > MAX_RANGE_DAYS) issue('Date range is too long (max 5 years)');
}

export const reportQuerySchema = reportBase.superRefine(checkRange);
export const csvQuerySchema = reportBase.extend({ section: z.enum(CSV_SECTIONS).default('transactions') }).superRefine(checkRange);
