import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db';
import { User } from '../src/models/User';

/** Creates the owner account. Credentials come from env vars; nothing is hardcoded. */
async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password || password.length < 8) {
    throw new Error('Set OWNER_EMAIL and OWNER_PASSWORD (min 8 chars) in your environment first.');
  }
  await connectDb();
  if (await User.exists({ email })) {
    console.log('Owner account already exists. Nothing to do.');
  } else {
    await User.create({
      name: 'Shefin Franklin',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      college: 'College of Engineering Trivandrum',
      department: 'Computer Science and Engineering',
      studentYear: 'First Year',
      hostel: "CET Men's Hostel",
    });
    console.log('Owner account created.');
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
