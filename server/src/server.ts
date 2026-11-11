import mongoose from 'mongoose';
import { createApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';

async function main() {
  await connectDb();
  const server = createApp().listen(env.PORT, () => console.log(`CampusLedger API listening on :${env.PORT}`));

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
