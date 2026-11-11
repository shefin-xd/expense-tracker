import { z } from 'zod';
import { STUDENT_YEARS } from '../models/User';
import { LEDGER_KINDS } from '../services/ledger.rules';
import { order, pageQuery, rangeQuery } from './common';

export const transactionListSchema = z.object({
  ...pageQuery,
  ...rangeQuery,
  type: z.enum(['income', 'expense']).optional(),
  kind: z.enum(LEDGER_KINDS).optional(),
  category: z.string().trim().max(60).optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['date', 'amount']).default('date'),
  order,
});

export const dashboardSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const categoryNameSchema = z.object({ name: z.string().trim().min(1).max(40) });

const password = z.string().min(8).max(128).regex(/[a-zA-Z]/, 'Password needs a letter').regex(/\d/, 'Password needs a number');
export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    college: z.string().trim().max(150),
    department: z.string().trim().min(1).max(100),
    studentYear: z.enum(STUDENT_YEARS),
    hostel: z.string().trim().max(100),
    preferences: z
      .object({
        theme: z.enum(['light', 'dark', 'system']),
        dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
        currency: z.literal('INR'),
        notifications: z.object({ feeDeadlines: z.boolean(), budgetWarnings: z.boolean(), repayments: z.boolean() }).partial(),
      })
      .partial(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });
export const accountDeleteSchema = z.object({ password: z.string().min(1).max(128) });
