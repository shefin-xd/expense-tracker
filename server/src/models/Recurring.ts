import { Schema, model } from 'mongoose';
import { INCOME_SOURCES, PAYMENT_METHODS } from './constants';
import { jsonOpts } from './json';

/**
 * A monthly item the user expects (parent allowance, mess fee, recharge). It never posts money by itself:
 * when it falls due the user confirms (optionally changing the amount) or skips that month.
 */
const recurringSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['income', 'expense'], required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    dayOfMonth: { type: Number, required: true, min: 1, max: 28 },
    source: { type: String, enum: INCOME_SOURCES },
    category: { type: String, trim: true, maxlength: 40 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'upi' },
    notes: { type: String, trim: true, maxlength: 500 },
    active: { type: Boolean, default: true },
    startMonth: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    lastHandledMonth: { type: String, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  },
  { timestamps: true, toJSON: jsonOpts },
);
recurringSchema.index({ userId: 1, active: 1 });
export const Recurring = model('Recurring', recurringSchema);
