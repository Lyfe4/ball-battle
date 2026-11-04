import { configDefaults, defineConfig } from 'vitest/config';
import { SECURITY_HEADERS } from './scripts/security-headers.ts';

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
  preview: {
    // `pnpm build && pnpm preview` serves dist/ with the production security headers (the same
    // set netlify.toml sets), so the CSP can be checked locally. The dev server has none: Vite's
    // HMR client injects inline styles that a strict CSP would block.
    port: 4199,
    strictPort: true,
    headers: { ...SECURITY_HEADERS },
  },
  test: {
    environment: 'node',
    // Two suites: "unit" (pnpm test) stays fast; "slow" (pnpm test:slow) holds the roster-wide
    // tests that play every matchup for whole matches. CI runs both, as separate jobs.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.slow.test.ts'],
        },
      },
      {
        extends: true,
        test: { name: 'slow', include: ['src/**/*.slow.test.ts', 'scripts/**/*.slow.test.ts'] },
      },
    ],
  },
});
