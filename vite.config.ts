import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';
import type { BrowserCommand } from 'vitest/node';
import { SECURITY_HEADERS } from './scripts/security-headers.ts';

/** Before every browser test file: no series saved by another file's flow (ADR 0042). */
const BROWSER_SETUP = 'src/flows/browser-setup.ts';

const tap: BrowserCommand<[selector: string]> = async (context, selector) => {
  await context.iframe.locator(selector).first().tap();
};

/**
 * A press at a point of the element marked `data-press-here` (settings-checks.ts): a finger's tap
 * on a touch phone, else a mouse click. Relative to the element, so the test frame's own
 * place on the page doesn't matter.
 */
const pressAt: BrowserCommand<[x: number, y: number, touch: boolean]> = async (
  context,
  x,
  y,
  touch,
) => {
  const target = context.iframe.locator('[data-press-here]').first();
  if (touch) await target.tap({ position: { x, y } });
  else await target.click({ position: { x, y } });
};

/**
 * Firefox headless draws about 180 frames a second where Chromium and WebKit draw 60, so each
 * Firefox page ran the arena three times as often as the others and was the busiest page on a
 * loaded machine: its clicks then waited behind its own frames, past their timeout. A 60 Hz
 * screen, as the other engines have (the game itself plays the same at any refresh rate).
 */
const launchOptions = { firefoxUserPrefs: { 'layout.frame_rate': 60 } };

/**
 * A touch phone project (ADR 0037, 0039): a context with touch at a fixed phone size, and a `tap`
 * command that taps like a finger (Playwright's own tap, which sends touch events and lets the
 * browser make the pointer events and click from them).
 */
function phoneProject(
  name: string,
  suffix: string,
  width: number,
  height: number,
): TestProjectInlineConfiguration {
  return {
    extends: true,
    test: {
      name,
      include: [`src/**/*.${suffix}.browser.test.ts`],
      browser: {
        enabled: true,
        provider: playwright({ launchOptions, contextOptions: { hasTouch: true } }),
        headless: true,
        screenshotFailures: false,
        viewport: { width, height },
        instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
        commands: { tap, pressAt },
      },
      setupFiles: [BROWSER_SETUP],
    },
  };
}

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
            '**/*.full.browser.test.ts',
            '**/*.touch.browser.test.ts',
            '**/*.iphone.browser.test.ts',
            '**/*.safari.browser.test.ts',
          ],
          setupFiles: [BROWSER_SETUP],
          browser: {
            enabled: true,
            provider: playwright({ launchOptions }),
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
          setupFiles: [BROWSER_SETUP],
          browser: {
            enabled: true,
            provider: playwright({ launchOptions }),
            headless: true,
            screenshotFailures: false,
            viewport: { width: 1280, height: 800 },
            commands: { pressAt },
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
          },
        },
      },
      {
        extends: true,
        test: {
          // Flows that must also hold on a full HD screen (`*.full.browser.test.ts`, ADR 0038), where
          // the legend bug was found: fixed at 1920 x 1080 for the same reason as browsers-wide.
          name: 'browsers-full',
          include: ['src/**/*.full.browser.test.ts'],
          setupFiles: [BROWSER_SETUP],
          browser: {
            enabled: true,
            provider: playwright({ launchOptions }),
            headless: true,
            screenshotFailures: false,
            viewport: { width: 1920, height: 1080 },
            commands: { pressAt },
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
          },
        },
      },
      // Flows on a touch phone (`*.touch.browser.test.ts`, ADR 0037).
      phoneProject('browsers-touch', 'touch', 375, 812),
      // A 390 x 844 iPhone with no browser chrome, and the same phone in Safari with its toolbars
      // shown (390 x 664), where the series arena shrank (ADR 0039).
      phoneProject('browsers-iphone', 'iphone', 390, 844),
      phoneProject('browsers-safari', 'safari', 390, 664),
    ],
  },
});
