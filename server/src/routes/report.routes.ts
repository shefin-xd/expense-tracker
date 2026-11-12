import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { reportToCsv } from '../exports/csv';
import { reportToPdf } from '../exports/pdf';
import { reportToXlsx } from '../exports/xlsx';
import { requireAuth } from '../middleware/auth';
import { queryOf, validateQuery } from '../middleware/validate';
import { notify } from '../services/notification.service';
import { buildReport } from '../services/report.service';
import { asyncHandler } from '../utils/asyncHandler';
import { reportQuerySchema } from '../validators/report.validators';

export const reportRouter = Router();
reportRouter.use(requireAuth);
reportRouter.use(rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' }));

const FORMATS = {
  pdf: { mime: 'application/pdf', ext: 'pdf' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  csv: { mime: 'text/csv; charset=utf-8', ext: 'csv' },
} as const;

for (const format of ['pdf', 'xlsx', 'csv'] as const) {
  reportRouter.get(`/${format}`, validateQuery(reportQuerySchema), asyncHandler(async (req, res) => {
    const q = queryOf(res, reportQuerySchema);
    const userId = req.userId!;
    // Every query inside buildReport is scoped to this user.
    const report = await buildReport(userId, q);
    // CSV is a single table; pick the dataset that fits the report unless asked.
    const dataset = q.dataset ?? ({ expenses: 'expenses', income: 'income', fees: 'fees' } as const)[report.type as 'expenses' | 'income' | 'fees'] ?? 'transactions';
    const body = format === 'pdf' ? await reportToPdf(report) : format === 'xlsx' ? await reportToXlsx(report) : Buffer.from(reportToCsv(report, dataset), 'utf8');
    const name = `campusledger-${report.type}-${report.label}${format === 'csv' ? `-${dataset}` : ''}.${FORMATS[format].ext}`;

    await notify(userId, { type: 'export_ready', title: 'Export ready', message: `Your ${report.title.toLowerCase()} (${format.toUpperCase()}) for ${report.label} was generated.`, dedupeKey: `export:${randomUUID()}` });
    res.status(200).set({ 'Content-Type': FORMATS[format].mime, 'Content-Length': String(body.length), 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'private, no-store' }).end(body);
  }));
}
