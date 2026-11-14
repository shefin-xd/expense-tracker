import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { PasswordReset } from '../models/PasswordReset';
import { resetEmail, sendMail } from './email.service';
import { User, toPublicUser } from '../models/User';
import { badRequest, conflict, notFound, unauthorized } from '../utils/errors';
import type { LoginInput, RegisterInput } from '../validators/auth.validators';

const ROUNDS = 12;
// Pre-computed hash so login takes similar time whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);

export async function registerUser(input: RegisterInput) {
  if (await User.exists({ email: input.email })) throw conflict('An account with this email already exists');
  const { password, ...profile } = input;
  const user = await User.create({ ...profile, passwordHash: await bcrypt.hash(password, ROUNDS) });
  return toPublicUser(user);
}

export async function loginUser({ email, password }: LoginInput) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Incorrect email or password');
  return toPublicUser(user);
}

export async function getUserById(id: string) {
  const user = await User.findById(id);
  if (!user) throw notFound('User not found');
  return toPublicUser(user);
}

const RESET_MINUTES = 60;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Always succeeds from the caller's view, so the response never reveals whether an email has an account. */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email });
  if (!user) return;
  const token = randomBytes(32).toString('hex');
  await PasswordReset.deleteMany({ userId: user._id }); // only the newest link works
  await PasswordReset.create({ userId: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) });
  const link = `${env.AUTH_URL}/reset-password?token=${token}`;
  try {
    await sendMail({ to: user.email, ...resetEmail(user.name, link, RESET_MINUTES) });
  } catch (e) {
    console.error('Could not send password reset email:', (e as Error).message);
  }
}

export async function resetPassword(token: string, password: string): Promise<string> {
  const record = await PasswordReset.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!record) throw badRequest('This reset link has expired or was already used. Ask for a new one.');
  const user = await User.findById(record.userId).select('+passwordHash');
  if (!user) throw badRequest('This reset link has expired or was already used. Ask for a new one.');
  user.passwordHash = await bcrypt.hash(password, ROUNDS);
  user.passwordChangedAt = new Date();
  await user.save();
  await PasswordReset.deleteMany({ userId: user._id });
  return String(user._id);
}
