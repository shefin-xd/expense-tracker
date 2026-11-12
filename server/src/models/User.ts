import { Schema, model, type InferSchemaType } from 'mongoose';

export const STUDENT_YEARS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year', 'Other'] as const;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    // Sessions issued before this moment are rejected (set on password change and reset).
    passwordChangedAt: { type: Date, select: false },
    college: { type: String, trim: true, maxlength: 150 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    studentYear: { type: String, enum: STUDENT_YEARS, required: true },
    hostel: { type: String, trim: true, maxlength: 100 },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
      currency: { type: String, default: 'INR' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      notifications: {
        feeDeadlines: { type: Boolean, default: true },
        budgetWarnings: { type: Boolean, default: true },
        repayments: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);

export function toPublicUser(u: {
  _id: unknown;
  name: string;
  email: string;
  college?: string | null;
  department: string;
  studentYear: string;
  hostel?: string | null;
  preferences?: unknown;
}) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    college: u.college ?? null,
    department: u.department,
    studentYear: u.studentYear,
    hostel: u.hostel ?? null,
    preferences: u.preferences,
  };
}
