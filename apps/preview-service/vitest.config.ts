import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000, // 1 minute default timeout
    hookTimeout: 30000, // 30 seconds for hooks
  },
});