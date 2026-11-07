import { playwright } from '@vitest/browser-playwright';
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
    // Three suites: "unit" (pnpm test) stays fast; "slow" (pnpm test:slow) holds the roster-wide
    // tests that play every matchup for whole matches; "browsers" (pnpm test:browsers) runs the
    // known match results in Chromium, Firefox and WebKit (ADR 0023). CI runs each as its own job.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.slow.test.ts', '**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        test: { name: 'slow', include: ['src/**/*.slow.test.ts', 'scripts/**/*.slow.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'browsers',
          // The known match results, and flows through the real page (`*.browser.test.ts`).
          include: ['src/golden/*.test.ts', 'src/**/*.browser.test.ts'],
          exclude: [
            ...configDefaults.exclude,
            '**/*.wide.browser.test.ts',
            '**/*.touch.browser.test.ts',
          ],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // There is no page to see: a failure is a list of matches, not a screenshot.
            screenshotFailures: false,
            // V8, SpiderMonkey and JavaScriptCore: every engine a player or a server might run.
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
          },
        },
      },
      {
        extends: true,
        test: {
          // Flows that need a desktop screen (a mouse hover, the arena beside a result), at a fixed
          // size: resizing the viewport during a run upset the session history of later files in
          // WebKit, so Back left the page.
          name: 'browsers-wide',
          include: ['src/**/*.wide.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotFailures: false,
            viewport: { width: 1280, height: 800 },
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
          },
        },
      },
      {
        extends: true,
        test: {
          // Flows on a touch phone (`*.touch.browser.test.ts`, ADR 0037): a context with touch, at
          // phone size, and a `tap` command that taps like a finger (Playwright's own tap, which
          // sends touch events and lets the browser make the pointer events and click from them).
          name: 'browsers-touch',
          include: ['src/**/*.touch.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright({ contextOptions: { hasTouch: true } }),
            headless: true,
            screenshotFailures: false,
            viewport: { width: 375, height: 812 },
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
            commands: {
              tap: async (context, selector: string) => {
                await context.iframe.locator(selector).first().tap();
              },
            },
          },
        },
      },
    ],
  },
});
