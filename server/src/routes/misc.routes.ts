import { Router } from 'express';
import { refreshSession } from '../controllers/auth.controller';
import { COOKIE_NAME, requireAuth } from '../middleware/auth';
import { bodyOf, queryOf, validateBody, validateQuery } from '../middleware/validate';
import { createCategory, deleteCategory, listCategories, renameCategory } from '../services/category.service';
import { getDashboard } from '../services/dashboard.service';
import { deleteNotification, listNotifications, markAllRead, markRead } from '../services/notification.service';
import { listTransactions } from '../services/transaction.service';
import { changePassword, deleteAccount, exportPersonalData, updateProfile } from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { currentMonthIST, monthRangeIST } from '../utils/dates';
import { ok, parseId } from '../utils/http';
import { accountDeleteSchema, categoryNameSchema, dashboardSchema, passwordChangeSchema, profileUpdateSchema, transactionListSchema } from '../validators/misc.validators';
import { getSummary } from '../services/ledger.service';

const protectedRouter = () => Router().use(requireAuth);

export const transactionRouter = protectedRouter();
transactionRouter.get('/', validateQuery(transactionListSchema), asyncHandler(async (req, res) => {
  const { items, meta } = await listTransactions(req.userId!, queryOf(res, transactionListSchema));
  ok(res, items, 200, meta);
}));
transactionRouter.get('/summary', validateQuery(dashboardSchema), asyncHandler(async (req, res) => {
  const q = queryOf(res, dashboardSchema);
  ok(res, await getSummary(req.userId!, { ...(q.from && { from: q.from }), ...(q.to && { to: q.to }) }));
}));

export const dashboardRouter = protectedRouter();
dashboardRouter.get('/', validateQuery(dashboardSchema), asyncHandler(async (req, res) => {
  const q = queryOf(res, dashboardSchema);
  const month = monthRangeIST(currentMonthIST());
  ok(res, await getDashboard(req.userId!, { from: q.from ?? month.from, to: q.to ?? month.to }));
}));

export const categoryRouter = protectedRouter();
categoryRouter.get('/', asyncHandler(async (req, res) => ok(res, await listCategories(req.userId!))));
categoryRouter.post('/', validateBody(categoryNameSchema), asyncHandler(async (req, res) => ok(res, await createCategory(req.userId!, bodyOf(req, categoryNameSchema).name), 201)));
categoryRouter.patch('/:id', validateBody(categoryNameSchema), asyncHandler(async (req, res) => ok(res, await renameCategory(req.userId!, parseId(req.params.id), bodyOf(req, categoryNameSchema).name))));
categoryRouter.delete('/:id', asyncHandler(async (req, res) => { await deleteCategory(req.userId!, parseId(req.params.id)); ok(res, null); }));

export const notificationRouter = protectedRouter();
notificationRouter.get('/', asyncHandler(async (req, res) => ok(res, await listNotifications(req.userId!, req.query.unread === 'true'))));
notificationRouter.post('/read-all', asyncHandler(async (req, res) => { await markAllRead(req.userId!); ok(res, null); }));
notificationRouter.post('/:id/read', asyncHandler(async (req, res) => ok(res, await markRead(req.userId!, parseId(req.params.id)))));
notificationRouter.delete('/:id', asyncHandler(async (req, res) => { await deleteNotification(req.userId!, parseId(req.params.id)); ok(res, null); }));

export const userRouter = protectedRouter();
userRouter.patch('/me', validateBody(profileUpdateSchema), asyncHandler(async (req, res) => ok(res, { user: await updateProfile(req.userId!, bodyOf(req, profileUpdateSchema)) })));
userRouter.post('/me/password', validateBody(passwordChangeSchema), asyncHandler(async (req, res) => {
  const b = bodyOf(req, passwordChangeSchema);
  await changePassword(req.userId!, b.currentPassword, b.newPassword);
  refreshSession(res, req.userId!); // this device stays signed in; all other sessions end
  ok(res, null);
}));
userRouter.get('/me/export', asyncHandler(async (req, res) => ok(res, await exportPersonalData(req.userId!))));
userRouter.delete('/me', validateBody(accountDeleteSchema), asyncHandler(async (req, res) => {
  await deleteAccount(req.userId!, bodyOf(req, accountDeleteSchema).password);
  res.clearCookie(COOKIE_NAME);
  ok(res, null);
}));
