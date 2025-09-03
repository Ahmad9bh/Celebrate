import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: [path.resolve(__dirname, 'test/setup.ts')],
    // Run test files one-by-one to avoid DB race conditions across suites
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    // Use a single worker to avoid parallel DB access
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    // Higher timeouts for integration-style tests hitting remote DB
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
