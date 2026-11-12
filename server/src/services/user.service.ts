import bcrypt from 'bcryptjs';
import { USER_OWNED } from '../models';
import { User, toPublicUser } from '../models/User';
import { badRequest, notFound, unauthorized } from '../utils/errors';
import { withTransaction } from '../utils/transaction';

type Profile = {
  name?: string; college?: string; department?: string; studentYear?: (typeof import('../models/User').STUDENT_YEARS)[number]; hostel?: string;
  preferences?: { theme?: 'light' | 'dark' | 'system'; dateFormat?: string; currency?: 'INR'; notifications?: { feeDeadlines?: boolean; budgetWarnings?: boolean; repayments?: boolean } };
};

export async function updateProfile(userId: string, patch: Profile) {
  const { preferences, ...fields } = patch;
  const $set: Record<string, unknown> = { ...fields };
  for (const [k, v] of Object.entries(preferences ?? {})) {
    if (k === 'notifications') for (const [nk, nv] of Object.entries(v as object)) $set[`preferences.notifications.${nk}`] = nv;
    else $set[`preferences.${k}`] = v;
  }
  const user = await User.findByIdAndUpdate(userId, { $set }, { returnDocument: 'after' });
  if (!user) throw notFound('User not found');
  return toPublicUser(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw unauthorized('Current password is incorrect');
  if (currentPassword === newPassword) throw badRequest('New password must be different');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  await user.save();
}

/** Permanently deletes the account and every record it owns. */
export async function deleteAccount(userId: string, password: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw unauthorized('Password is incorrect');
  await withTransaction(async (session) => {
    for (const model of Object.values(USER_OWNED)) await (model as typeof USER_OWNED.expenses).deleteMany({ userId }, { session });
    await User.deleteOne({ _id: userId }, { session });
  });
}

/** Everything the user owns, as one JSON document. */
export async function exportPersonalData(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  const data: Record<string, unknown> = { exportedAt: new Date().toISOString(), profile: toPublicUser(user) };
  for (const [key, model] of Object.entries(USER_OWNED)) data[key] = await (model as typeof USER_OWNED.expenses).find({ userId });
  return data;
}
