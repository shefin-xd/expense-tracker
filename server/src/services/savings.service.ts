import { Types } from 'mongoose';
import { SavingsGoal } from '../models/SavingsGoal';
import { badRequest, notFound } from '../utils/errors';
import { percent } from './status.rules';

type GoalInput = { name: string; targetPaise: number; savedPaise: number; targetDate?: Date | undefined; description?: string | undefined };
type GoalDoc = InstanceType<typeof SavingsGoal>;
const view = (g: GoalDoc) => ({ ...g.toJSON(), remainingPaise: Math.max(0, g.targetPaise - g.savedPaise), percentSaved: percent(g.savedPaise, g.targetPaise), reached: g.savedPaise >= g.targetPaise });

export const createGoal = async (userId: string, input: GoalInput) => view(await SavingsGoal.create({ ...input, userId: new Types.ObjectId(userId) }));
export async function listGoals(userId: string) {
  const goals = await SavingsGoal.find({ userId }).sort({ createdAt: -1 });
  return { goals: goals.map(view), totalSavedPaise: goals.reduce((s, g) => s + g.savedPaise, 0), totalTargetPaise: goals.reduce((s, g) => s + g.targetPaise, 0) };
}
export async function updateGoal(userId: string, id: string, patch: Partial<GoalInput>) {
  const g = await SavingsGoal.findOne({ _id: id, userId });
  if (!g) throw notFound('Savings goal not found');
  if ((patch.targetPaise ?? g.targetPaise) <= 0) throw badRequest('Target must be positive');
  g.set(patch);
  await g.save();
  return view(g);
}
export async function deleteGoal(userId: string, id: string) {
  if ((await SavingsGoal.deleteOne({ _id: id, userId })).deletedCount === 0) throw notFound('Savings goal not found');
}
