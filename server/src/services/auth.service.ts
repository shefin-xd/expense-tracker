import bcrypt from 'bcryptjs';
import { User, toPublicUser } from '../models/User';
import { conflict, notFound, unauthorized } from '../utils/errors';
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
