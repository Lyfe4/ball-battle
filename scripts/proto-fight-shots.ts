// PROTOTYPE ONLY (proto/ball-looks): the new looks in real Free play fights on a phone (390 x 664)
// and a desktop (1280 x 800), a few moments into each, and one with reduced motion. Needs `pnpm dev`.
import { chromium } from 'playwright';
import { RULESET_VERSION } from '../src/sim/ruleset.ts';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const OUT = 'docs/proposals/ball-looks';
const FIGHTS = [
  ['titan', 'brawler', 14_000],
  ['berserker', 'venom', 9_000],
  ['speedster', 'thorns', 7_000],
  ['boomerang', 'battery', 6_500],
  ['battery', 'storm', 12_000],
] as const;

const browser = await chromium.launch();
for (const [name, viewport, scale, reducedMotion] of [
  ['phone', { width: 390, height: 664 }, 3, 'no-preference'],
  ['desktop', { width: 1280, height: 800 }, 2, 'no-preference'],
  ['phone-reduced', { width: 390, height: 664 }, 3, 'reduce'],
] as const) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, reducedMotion });
  for (const [a, b, wait] of FIGHTS) {
    if (name === 'phone-reduced' && a !== 'berserker') continue;
    const page = await context.newPage();
    await page.goto(`${BASE}/?a=${a}&b=${b}&seed=7&v=${String(RULESET_VERSION)}`);
    await page.getByRole('button', { name: 'Fight!' }).click();
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/fight-${a}-${b}-${name}.png` });
    await page.close();
  }
  await context.close();
}
await browser.close();
