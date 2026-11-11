import { Schema, model } from 'mongoose';
import { jsonOpts } from './json';

const repaymentSchema = new Schema(
  {
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    date: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 300 },
  },
  { toJSON: jsonOpts },
);

/** direction 'lent' = a friend owes me; 'borrowed' = I owe a friend. */
const loanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    direction: { type: String, enum: ['lent', 'borrowed'], required: true },
    person: { type: String, required: true, trim: true, maxlength: 100 },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    repaidPaise: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
    date: { type: Date, required: true },
    expectedDate: { type: Date },
    notes: { type: String, trim: true, maxlength: 1000 },
    repayments: { type: [repaymentSchema], default: [] },
  },
  { timestamps: true, toJSON: jsonOpts },
);
loanSchema.index({ userId: 1, direction: 1, date: -1 });
export const Loan = model('Loan', loanSchema);
