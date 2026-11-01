import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'es2023',
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
