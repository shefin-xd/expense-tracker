import { Schema, model, type InferSchemaType } from 'mongoose';
import { LEDGER_KINDS } from '../services/ledger.rules';
import { jsonOpts } from './json';

/**
 * One immutable money movement. Balance, dashboard, history and reports are all
 * derived from this collection so the numbers can never disagree.
 * Amounts are always positive integer paise; direction comes from `kind`.
 */
const ledgerEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: LEDGER_KINDS, required: true },
    amountPaise: {
      type: Number,
      required: true,
      validate: { validator: Number.isSafeInteger, message: 'amountPaise must be an integer' },
      min: 1,
    },
    date: { type: Date, required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    category: { type: String, trim: true, maxlength: 60 },
    // The domain record this entry came from (expense, income, feePayment, lending...).
    sourceType: { type: String, required: true },
    sourceId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true, toJSON: jsonOpts },
);

ledgerEntrySchema.index({ userId: 1, date: -1 });
ledgerEntrySchema.index({ userId: 1, kind: 1, date: -1 });
ledgerEntrySchema.index({ userId: 1, category: 1, date: -1 });
// A source record can post to the ledger only once: prevents duplicate transactions.
ledgerEntrySchema.index({ userId: 1, sourceType: 1, sourceId: 1 }, { unique: true });

export type LedgerEntryDoc = InferSchemaType<typeof ledgerEntrySchema>;
export const LedgerEntry = model('LedgerEntry', ledgerEntrySchema);
