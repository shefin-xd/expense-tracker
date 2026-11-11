import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/campusledger-test',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123',
      CLIENT_URL: 'http://localhost:5173',
    },
  },
});
