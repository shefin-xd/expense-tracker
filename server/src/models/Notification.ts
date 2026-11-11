import { Schema, model } from 'mongoose';
import { jsonOpts } from './json';

export const NOTIFICATION_TYPES = ['fee_due_soon', 'fee_overdue', 'budget_warning', 'repayment_due', 'export_ready'] as const;

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 400 },
    // Same condition never notifies twice (e.g. "fee:<id>:overdue").
    dedupeKey: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: jsonOpts },
);
notificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
export const Notification = model('Notification', notificationSchema);
