import { z } from 'zod';
import { CSV_DATASETS } from '../exports/csv';
import { REPORT_TYPES } from '../services/report.service';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const reportQuerySchema = z.object({
  type: z.enum(REPORT_TYPES).default('monthly'),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-11').optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  from: day.optional(),
  to: day.optional(),
  academicYear: z.string().trim().max(20).optional(),
  dataset: z.enum(CSV_DATASETS).optional(),
});
