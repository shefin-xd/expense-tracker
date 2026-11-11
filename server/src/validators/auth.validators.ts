import { z } from 'zod';
import { STUDENT_YEARS } from '../models/User';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-zA-Z]/, 'Password needs a letter')
  .regex(/\d/, 'Password needs a number');

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password,
  college: z.string().trim().max(150).optional(),
  department: z.string().trim().min(1).max(100),
  studentYear: z.enum(STUDENT_YEARS),
  hostel: z.string().trim().max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
