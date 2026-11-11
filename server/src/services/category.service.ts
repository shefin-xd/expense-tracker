import { Types } from 'mongoose';
import { Budget } from '../models/Budget';
import { Category } from '../models/Category';
import { DEFAULT_EXPENSE_CATEGORIES } from '../models/constants';
import { Expense } from '../models/Expense';
import { LedgerEntry } from '../models/LedgerEntry';
import { badRequest, conflict, notFound } from '../utils/errors';
import { withTransaction } from '../utils/transaction';

const isDefault = (name: string) => DEFAULT_EXPENSE_CATEGORIES.some((d) => d.toLowerCase() === name.toLowerCase());

export async function listCategories(userId: string) {
  const custom = await Category.find({ userId }).sort({ name: 1 });
  return { defaults: [...DEFAULT_EXPENSE_CATEGORIES], custom };
}

export async function assertCategoryAllowed(userId: string, name: string) {
  if (isDefault(name)) return;
  if (!(await Category.exists({ userId, name }).collation({ locale: 'en', strength: 2 })))
    throw badRequest(`Unknown category "${name}". Create it first or use a default category.`);
}

export async function createCategory(userId: string, name: string) {
  if (isDefault(name)) throw conflict('That is already a default category');
  try {
    return await Category.create({ userId, name });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw conflict('You already have that category');
    throw e;
  }
}

export async function renameCategory(userId: string, id: string, name: string) {
  if (isDefault(name)) throw conflict('That is already a default category');
  const cat = await Category.findOne({ _id: id, userId });
  if (!cat) throw notFound('Category not found');
  const old = cat.name;
  try {
    await withTransaction(async (session) => {
      cat.name = name;
      await cat.save({ session });
      await Expense.updateMany({ userId, category: old }, { $set: { category: name } }, { session });
      await LedgerEntry.updateMany({ userId, category: old }, { $set: { category: name } }, { session });
      await Budget.updateMany(
        { userId: new Types.ObjectId(userId) },
        { $set: { 'categories.$[c].category': name } },
        { session, arrayFilters: [{ 'c.category': old }] },
      );
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw conflict('You already have that category');
    throw e;
  }
  return cat;
}

export async function deleteCategory(userId: string, id: string) {
  const cat = await Category.findOne({ _id: id, userId });
  if (!cat) throw notFound('Category not found');
  if (await Expense.exists({ userId, category: cat.name }))
    throw conflict('This category is used by existing expenses. Move or delete those first.');
  await cat.deleteOne();
}
