import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'es2023',
  },
  server: {
    // One fixed port for every session and contributor; fail loudly if it is taken rather than
    // silently moving to the next free one.
    port: 5199,
    strictPort: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
