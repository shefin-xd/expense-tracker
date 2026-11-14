import { Schema, model } from 'mongoose';

/** Remembers the outcome of a write for 24 hours so a retried request never records the money twice. */
const idempotencySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    key: { type: String, required: true },
    fingerprint: { type: String, required: true },
    state: { type: String, enum: ['processing', 'done'], required: true },
    status: Number,
    body: Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, expires: 24 * 60 * 60 },
  },
  { versionKey: false },
);
idempotencySchema.index({ userId: 1, key: 1 }, { unique: true });
export const IdempotencyKey = model('IdempotencyKey', idempotencySchema);
