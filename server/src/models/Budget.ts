import { Schema, model } from 'mongoose';
import { jsonOpts } from './json';

const budgetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    overallPaise: { type: Number, min: 1, validate: Number.isSafeInteger },
    categories: {
      type: [
        new Schema(
          { category: { type: String, required: true, trim: true, maxlength: 40 }, limitPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger } },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, toJSON: jsonOpts },
);
budgetSchema.index({ userId: 1, month: 1 }, { unique: true });
export const Budget = model('Budget', budgetSchema);
