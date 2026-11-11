import { Schema, model } from 'mongoose';
import { INCOME_SOURCES, PAYMENT_METHODS } from './constants';
import { jsonOpts } from './json';

const incomeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    source: { type: String, enum: INCOME_SOURCES, required: true },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    date: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 500 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'upi' },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true, toJSON: jsonOpts },
);
incomeSchema.index({ userId: 1, date: -1 });
incomeSchema.index({ userId: 1, source: 1, date: -1 });
export const Income = model('Income', incomeSchema);
