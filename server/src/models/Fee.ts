import { Schema, model } from 'mongoose';
import { FEE_CATEGORIES } from './constants';
import { jsonOpts } from './json';

const feeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    category: { type: String, enum: FEE_CATEGORIES, required: true },
    academicYear: { type: String, required: true, trim: true, maxlength: 20 }, // e.g. "2026-27"
    totalPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    // Sum of this fee's FeePayments. Only changed atomically together with a payment.
    paidPaise: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
    dueDate: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true, toJSON: jsonOpts },
);
feeSchema.index({ userId: 1, dueDate: 1 });
feeSchema.index({ userId: 1, academicYear: 1 });
export const Fee = model('Fee', feeSchema);

const feePaymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    feeId: { type: Schema.Types.ObjectId, ref: 'Fee', required: true },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    date: { type: Date, required: true },
    referenceNo: { type: String, trim: true, maxlength: 80 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, toJSON: jsonOpts },
);
feePaymentSchema.index({ userId: 1, feeId: 1, date: -1 });
export const FeePayment = model('FeePayment', feePaymentSchema);
