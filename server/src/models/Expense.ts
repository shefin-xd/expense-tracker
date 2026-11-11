import { Schema, model } from 'mongoose';
import { PAYMENT_METHODS } from './constants';
import { jsonOpts } from './json';

const expenseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    category: { type: String, required: true, trim: true, maxlength: 40 },
    date: { type: Date, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'upi' },
    description: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 1000 },
    // Optional link to an already-uploaded receipt (file storage is provider-specific).
    receiptUrl: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, toJSON: jsonOpts },
);
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1, date: -1 });
export const Expense = model('Expense', expenseSchema);
