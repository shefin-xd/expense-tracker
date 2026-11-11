import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';

let rs: MongoMemoryReplSet | undefined;

/** Real MongoDB replica set (transactions need one). Downloaded on first run by mongodb-memory-server. */
export async function startDb() {
  rs = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(rs.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}
export async function stopDb() {
  await mongoose.disconnect();
  await rs?.stop();
}
export async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

export type Agent = ReturnType<typeof request.agent>;
const app = createApp();
let counter = 0;

/** Registers a brand-new user through the real API and returns a cookie-carrying agent. */
export async function signup(label = 'user'): Promise<{ agent: Agent; email: string; id: string }> {
  const agent = request.agent(app);
  const email = `${label}${++counter}@example.com`;
  const res = await agent.post('/api/auth/register').send({
    name: `Test ${label}`, email, password: 'Passw0rd!x', department: 'Computer Science and Engineering', studentYear: 'First Year',
  });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, email, id: res.body.data.user.id as string };
}
export const anonymous = () => request(app);

export async function balance(agent: Agent): Promise<number> {
  const res = await agent.get('/api/transactions/summary');
  return res.body.data.balancePaise as number;
}
export const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString();
