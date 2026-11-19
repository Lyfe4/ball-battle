// PROTOTYPE ONLY (proto/ball-looks-2): the Bomber's round-3 look in real Free play fights on a phone (390 x 664)
// and a desktop (1280 x 800), a few moments into each, and the phone with reduced motion. Needs
// `pnpm dev`.
import { chromium } from 'playwright';
import { RULESET_VERSION } from '../src/sim/ruleset.ts';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const OUT = 'docs/proposals/ball-looks-2';
const FIGHTS = [['bomber', 'speedster', 'new']] as const;
const MOMENTS = [1_500, 3_500, 5_500];

const browser = await chromium.launch();
for (const [name, viewport, scale, reducedMotion] of [
  ['phone', { width: 390, height: 664 }, 3, 'no-preference'],
  ['desktop', { width: 1280, height: 800 }, 2, 'no-preference'],
  ['phone-reduced', { width: 390, height: 664 }, 3, 'reduce'],
] as const) {
  for (const [a, b, look] of FIGHTS) {
    // A fresh device each time: a matchup seen once skips its Fight! card.
    const context = await browser.newContext({ viewport, deviceScaleFactor: scale, reducedMotion });
    const page = await context.newPage();
    await page.goto(`${BASE}/?a=${a}&b=${b}&seed=7&v=${String(RULESET_VERSION)}`);
    await page.getByRole('button', { name: 'Fight!' }).click();
    let waited = 0;
    for (const moment of MOMENTS) {
      await page.waitForTimeout(moment - waited);
      waited = moment;
      await page.screenshot({
        path: `${OUT}/fight-${a}-${look}-${name}-${String(moment / 1000)}s.png`,
      });
    }
    await context.close();
  }
}
await browser.close();
