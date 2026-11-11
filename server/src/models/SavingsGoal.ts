import { Schema, model } from 'mongoose';
import { jsonOpts } from './json';

const savingsGoalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    targetPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    savedPaise: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
    targetDate: { type: Date },
    description: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, toJSON: jsonOpts },
);
savingsGoalSchema.index({ userId: 1, createdAt: -1 });
export const SavingsGoal = model('SavingsGoal', savingsGoalSchema);
