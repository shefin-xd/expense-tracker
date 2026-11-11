import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { queryOf, validateQuery } from '../middleware/validate';
import { notify } from '../services/notification.service';
import { buildPdf } from '../services/report.pdf';
import { buildReport, resolveRange, type ReportData } from '../services/report.service';
import { tableToCsv } from '../services/report.csv';
import { buildTables } from '../services/report.tables';
import { buildWorkbook } from '../services/report.xlsx';
import { User } from '../models/User';
import type { DateFormat } from '../utils/dates';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/http';
import { csvQuerySchema, reportQuerySchema } from '../validators/report.validators';

export const reportRouter = Router().use(requireAuth);

type Q = { scope: ReportData['meta']['scope']; month?: string | undefined; year?: number | undefined; from?: Date | undefined; to?: Date | undefined };

async function load(userId: string, q: Q): Promise<ReportData> {
  const user = await User.findById(userId).select('preferences.dateFormat').lean();
  const fmt = (user?.preferences?.dateFormat as DateFormat | undefined) ?? 'DD/MM/YYYY';
  return buildReport(userId, q.scope, resolveRange(q, new Date(), fmt));
}

const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function send(res: Response, userId: string, d: ReportData, format: 'pdf' | 'xlsx' | 'csv', body: Buffer | string, mime: string, suffix = '') {
  // Tell the user once the file really exists; a failed notification must never fail the download.
  await notify(userId, {
    type: 'export_ready', title: 'Export ready',
    message: `Your ${format.toUpperCase()} report for ${d.meta.label} was generated.`.slice(0, 400),
    dedupeKey: `export:${format}:${randomUUID()}`,
  }).catch(() => undefined);
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'no-store');
  res.attachment(`CampusLedger_${slug(d.meta.label)}_${d.meta.scope}${suffix}.${format}`);
  res.send(body);
}

/** JSON preview for the Reports page: totals, categories and upcoming items, without the row-level data. */
reportRouter.get('/summary', validateQuery(reportQuerySchema), asyncHandler(async (req, res) => {
  const d = await load(req.userId!, queryOf(res, reportQuerySchema));
  const { transactions: _t, income: _i, expenses: _e, ...rest } = d;
  ok(res, rest);
}));

reportRouter.get('/pdf', validateQuery(reportQuerySchema), asyncHandler(async (req, res) => {
  const d = await load(req.userId!, queryOf(res, reportQuerySchema));
  await send(res, req.userId!, d, 'pdf', await buildPdf(d), 'application/pdf');
}));

reportRouter.get('/xlsx', validateQuery(reportQuerySchema), asyncHandler(async (req, res) => {
  const d = await load(req.userId!, queryOf(res, reportQuerySchema));
  await send(res, req.userId!, d, 'xlsx', await buildWorkbook(d), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}));

reportRouter.get('/csv', validateQuery(csvQuerySchema), asyncHandler(async (req, res) => {
  const q = queryOf(res, csvQuerySchema);
  // The section decides which data has to be loaded; only the transaction list honours ?scope=.
  const byScope: Record<typeof q.section, Q['scope'] | null> = {
    income: 'income', expenses: 'expenses', categories: 'expenses', fees: 'fees', fee_payments: 'fees',
    lent: 'all', borrowed: 'all', budgets: 'all', savings: 'all', transactions: null, summary: null,
  };
  const d = await load(req.userId!, { ...q, scope: byScope[q.section] ?? q.scope });
  const table = buildTables(d)[q.section];
  await send(res, req.userId!, d, 'csv', tableToCsv(table), 'text/csv; charset=utf-8', `_${q.section}`);
}));
