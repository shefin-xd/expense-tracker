import { Schema, model } from 'mongoose';

/** Only a SHA-256 hash of the emailed token is stored, so a database leak cannot be used to reset passwords. */
const passwordResetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB removes expired rows itself
export const PasswordReset = model('PasswordReset', passwordResetSchema);
